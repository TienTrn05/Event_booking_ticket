import { randomUUID } from 'node:crypto';
import { pool } from '../../src/shared/database/pool.js';
import { withTransaction } from '../../src/shared/database/transaction.js';
import { createSession } from '../../src/modules/auth/session/session.service.js';
import { OrganizationService } from '../../src/modules/organizations/application/organization.service.js';
import { EventManagementService } from '../../src/modules/events/management/event-management.service.js';
import {
  draftInput,
  layoutInput,
  zoneLayoutInput,
  sessionInput,
  pricingInput,
  zonePricingInput,
} from '../../src/modules/events/management/event-management.schema.js';
import type { RequestActor } from '../../src/shared/auth/request-actor.js';
import type {
  PaymentGateway,
  PaymentRequest,
  PaymentLink,
  Receipt,
} from '../../src/modules/payments/application/payment.ports.js';
export const uid = () => randomUUID();
export async function v1Account(
  role: 'CUSTOMER' | 'ORGANIZER' | 'ADMIN' = 'CUSTOMER',
): Promise<RequestActor> {
  const u = (
      await pool.query<{ id: string }>(
        "INSERT INTO users(display_name,gender,date_of_birth,registration_role,onboarding_completed_at) VALUES('V1 fixture','UNDISCLOSED','1990-01-02',$1,now()) RETURNING id::text",
        [role === 'ADMIN' ? 'CUSTOMER' : role],
      )
    ).rows[0]!,
    email = uid() + '@fixture.invalid';
  const identity = (
    await pool.query<{ id: string }>(
      "INSERT INTO external_identities(user_id,provider,subject,email_canonical,email_verified_at,verified_at) VALUES($1,'EMAIL',$2,$2,now(),now()) RETURNING id::text",
      [u.id, email],
    )
  ).rows[0]!;
  await pool.query(
    'INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code=$2',
    [u.id, role],
  );
  const s = await withTransaction((db) =>
    createSession(
      db,
      { userId: u.id, identityId: identity.id, displayName: 'Fixture', authVersion: 0 },
      uid(),
    ),
  );
  return { id: u.id, sessionId: s.sessionId, authVersion: 0 };
}
export async function v1Organization(owner: RequestActor, admin: RequestActor) {
  const s = new OrganizationService(),
    o = (await s.apply(owner, { name: 'V1 ' + uid() }, uid(), uid()))!;
  await s.decide(admin, o.id, true, { version: o.version, reason: 'Fixture' }, uid(), uid());
  return o.id;
}
export async function v1Event(
  owner: RequestActor,
  admin: RequestActor,
  orgId: string,
  mode: 'NUMBERED' | 'QUANTITY' = 'NUMBERED',
  sessionCount = 1,
) {
  const s = new EventManagementService();
  let g = await s.create(
    owner,
    draftInput.parse({
      organizationId: orgId,
      ticketingMode: mode,
      title: 'V1 ' + uid(),
      categoryId: '1',
      description: 'Fixture event',
    }),
    uid(),
    uid(),
  );
  const id = g.event!.id;
  const layout =
    mode === 'NUMBERED'
      ? layoutInput.parse({
          version: 0,
          venueId: '904001',
          seats: [{ section: 'Main', row: 'A', number: '1', x: 3, y: 3, width: 1, height: 1 }],
        })
      : zoneLayoutInput.parse({
          version: 0,
          venueId: '904001',
          zones: [{ code: 'GA', name: 'General', capacity: 3, x: 3, y: 3, width: 4, height: 4 }],
        });
  g = await s.configure(
    owner,
    id,
    mode === 'NUMBERED' ? 'layout' : 'zone-layout',
    layout,
    0,
    uid(),
    uid(),
  );
  const time = (days: number) =>
    new Date(Math.floor(Date.now() / 1000) * 1000 + days * 86400000).toISOString();
  const sessions: { id: string; typeId: string }[] = [];
  for (let index = 0; index < sessionCount; index++) {
    const session = sessionInput.parse({
      version: g.event!.version,
      layoutId: g.layouts[0]!.id,
      startsAt: time(60 + index * 10),
      endsAt: time(61 + index * 10),
      saleOpensAt: time(-1),
      saleClosesAt: time(59 + index * 10),
      counterOpensAt: time(-1),
      counterClosesAt: time(60 + index * 10),
      admissionOpensAt: time(-1),
      admissionClosesAt: time(61 + index * 10),
    });
    g = await s.configure(owner, id, 'session', session, session.version, uid(), uid());
    const sid = g.sessions[index]!.id;
    g = await s.configure(
      owner,
      id,
      'type',
      { version: g.event!.version, code: 'STANDARD', name: 'Standard' },
      g.event!.version,
      uid(),
      uid(),
      sid,
    );
    const tt = (
      await pool.query<{ id: string }>('SELECT id::text FROM ticket_types WHERE session_id=$1', [
        sid,
      ])
    ).rows[0]!.id;
    const price =
      mode === 'NUMBERED'
        ? pricingInput.parse({
            version: g.event!.version,
            prices: g.seats.map((seat) => ({
              seatId: seat.id,
              ticketTypeId: tt,
              priceMinor: '9000',
              currency: 'VND',
            })),
          })
        : zonePricingInput.parse({
            version: g.event!.version,
            prices: g.zones.map((z) => ({
              sectionId: z.id,
              ticketTypeId: tt,
              priceMinor: '9000',
              currency: 'VND',
            })),
          });
    g = await s.configure(
      owner,
      id,
      mode === 'NUMBERED' ? 'prices' : 'zone-prices',
      price,
      price.version,
      uid(),
      uid(),
      sid,
    );
    sessions.push({ id: sid, typeId: tt });
  }
  await pool.query(
    "UPDATE events SET cover_image_url='https://images.fixture.invalid/v1.png' WHERE id=$1",
    [id],
  );
  g = await s.submit(owner, id, g.event!.version, uid(), uid());
  await s.decide(
    admin,
    g.reviews[0]!.id,
    'APPROVED',
    { version: g.event!.version, reason: 'Fixture' },
    uid(),
    uid(),
  );
  const e = (
    await pool.query<{ public_id: string; version: number }>(
      'SELECT public_id,version FROM events WHERE id=$1',
      [id],
    )
  ).rows[0]!;
  return {
    id,
    sessionId: sessions[0]!.id,
    typeId: sessions[0]!.typeId,
    sessions,
    publicId: e.public_id,
    version: e.version,
    layoutId: g.layouts[0]!.id,
  };
}
export class V1Gateway implements PaymentGateway {
  links = new Map<number, PaymentLink>();
  requests = new Map<number, PaymentRequest>();
  async create(p: PaymentRequest) {
    const l = {
      orderCode: p.orderCode,
      amount: p.amount,
      id: uid().replaceAll('-', ''),
      checkoutUrl: 'https://pay.payos.vn/web/fixture',
    };
    this.links.set(p.orderCode, l);
    this.requests.set(p.orderCode, p);
    return l;
  }
  async find(code: number) {
    const l = this.links.get(code);
    if (!l) throw new Error('Missing');
    return l;
  }
  async status(code: number) {
    return { link: await this.find(code), status: 'PENDING', receipts: [], amountPaid: 0 };
  }
  async verify(payload: unknown): Promise<Receipt> {
    void payload;
    throw new Error('No unsigned webhooks');
  }
}
