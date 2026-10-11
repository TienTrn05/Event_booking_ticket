import { randomBytes, randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { pool } from '../src/shared/database/pool.js';
import { createHold } from '../src/modules/bookings/holds/hold.service.js';
import {
  createBooking,
  cancelBooking,
} from '../src/modules/bookings/orders/booking-command.service.js';
import { saveAttendees } from '../src/modules/tickets/attendees/attendee.service.js';
import { attendeesInput } from '../src/modules/tickets/attendees/attendee.schema.js';
import { PaymentService } from '../src/modules/payments/application/payment.service.js';
import { BookingPaymentAdapter } from '../src/modules/bookings/payments/booking-payment.adapter.js';
import { DatabaseTicketIssuer } from '../src/modules/tickets/issuance/ticket-issuer.js';
import { TicketService } from '../src/modules/tickets/application/ticket.service.js';
import type {
  PaymentGateway,
  PaymentRequest,
  PaymentLink,
  Receipt,
  TicketIssuer,
} from '../src/modules/payments/application/payment.ports.js';
import type { RequestActor } from '../src/shared/auth/request-actor.js';
import { createApp } from '../src/app.js';
import { accessToken } from '../src/modules/auth/session/session.service.js';
import { expireAllocation } from '../src/modules/bookings/allocation/allocation.service.js';
import { env } from '../src/config/env.js';
import { postgresCatalogRepository } from '../src/modules/catalog/catalog.repository.js';
import * as roomRepository from '../src/modules/bookings/waiting-room/waiting-room.repository.js';
import * as roomService from '../src/modules/bookings/waiting-room/waiting-room.service.js';
import { runCommerceBrowser } from './fixtures/commerce-browser.js';

class FixtureGateway implements PaymentGateway {
  links = new Map<number, PaymentLink>();
  receipts = new Map<number, Receipt[]>();
  calls = 0;
  timeoutAfterCreate = false;
  unavailable = false;
  async create(input: PaymentRequest) {
    this.calls++;
    if (this.unavailable) throw new Error('Offline');
    const link = {
      orderCode: input.orderCode,
      amount: input.amount,
      id: randomUUID().replaceAll('-', ''),
      checkoutUrl: 'https://pay.payos.vn/web/fixture',
    };
    this.links.set(input.orderCode, link);
    if (this.timeoutAfterCreate) throw new Error('Timeout after provider committed');
    return link;
  }
  async find(code: number) {
    const link = this.links.get(code);
    if (!link) throw new Error('Not found');
    return link;
  }
  async status(code: number) {
    const link = await this.find(code);
    const receipts = this.receipts.get(code) ?? [];
    return {
      link,
      status: 'PENDING',
      amountPaid: receipts.reduce((sum, r) => sum + Number(r.amount), 0),
      receipts,
    };
  }
  async verify(): Promise<Receipt> {
    throw new Error('Fixture accepts no public webhook');
  }
}
const gateway = new FixtureGateway(),
  port = new BookingPaymentAdapter(),
  issuer = new DatabaseTicketIssuer();
const payments = new PaymentService(gateway, port, issuer, 'http://127.0.0.1:5173'),
  tickets = new TicketService(port);
const query = async (sql: string, args: unknown[] = []) => pool.query(sql, args);
let sessionId: string,
  publicId: string,
  eventId: string,
  staff: RequestActor,
  otherStaff: RequestActor;
async function customer() {
  const user = (
    await query("INSERT INTO users(display_name) VALUES('Commerce fixture') RETURNING id::text")
  ).rows[0];
  const identity = (
    await query(
      "INSERT INTO external_identities(user_id,provider,subject,email_canonical,email_verified_at,verified_at) VALUES($1,'EMAIL',$2,$2,now(),now()) RETURNING id::text",
      [user.id, randomUUID() + '@fixture.invalid'],
    )
  ).rows[0];
  await query(
    "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='CUSTOMER'",
    [user.id],
  );
  return session(user.id, identity.id);
}
async function session(userId: string, identityId: string): Promise<RequestActor> {
  const s = (
    await query(
      "INSERT INTO auth_sessions(user_id,identity_id,authenticated_at,family_id,expires_at) VALUES($1,$2,now(),$3,now()+interval '7 days') RETURNING id::text",
      [userId, identityId, randomBytes(32)],
    )
  ).rows[0];
  return { id: userId, sessionId: s.id, authVersion: 0 };
}
async function booking(count = 1, withAttendees = true) {
  const actor = await customer();
  const seats = (
    await query(
      "SELECT id::text FROM session_seats WHERE session_id=$1 AND status='AVAILABLE' ORDER BY id LIMIT $2",
      [sessionId, count],
    )
  ).rows.map((r) => r.id as string);
  const hold = await createHold(
    actor,
    publicId,
    sessionId,
    seats,
    randomUUID(),
    randomUUID(),
    async () => {},
  );
  const result = await createBooking(
    actor,
    {
      holdId: hold.data.id,
      attendees: seats.map((id, i) => ({ sessionSeatId: id, attendeeName: `Person ${i}` })),
    },
    randomUUID(),
    randomUUID(),
  );
  const order = result.data as { id: string; items: { id: string; sessionSeatId: string }[] };
  const attendeeRows = attendeesInput.parse({
    attendees: order.items.map((item, i) => ({
      bookingItemId: item.id,
      fullName: `Person ${i}`,
      dateOfBirth: '1990-01-02',
      phone: '0901234567',
      cccd: `00000000000${i}`,
    })),
  }).attendees;
  if (withAttendees) await saveAttendees(actor, result.data.id, attendeeRows, randomUUID());
  return { actor, order, attendeeRows };
}
async function receipt(paymentId: string, amount?: string) {
  const p = (
    await query(
      'SELECT provider_key,provider_reference,amount_minor::text FROM payments WHERE id=$1',
      [paymentId],
    )
  ).rows[0];
  return {
    orderCode: p.provider_key,
    amount: amount ?? p.amount_minor,
    reference: randomUUID(),
    paymentLinkId: p.provider_reference,
    currency: 'VND',
    code: '00',
  } satisfies Receipt;
}
async function state(id: string) {
  return (
    await query(
      'SELECT b.status,(SELECT count(*)::int FROM booking_items bi JOIN tickets t ON t.booking_item_id=bi.id WHERE bi.booking_id=b.id) AS tickets FROM bookings b WHERE b.id=$1',
      [id],
    )
  ).rows[0];
}
describe.skipIf(!process.env.COMMERCE_TEST_DB_PORT)('commerce against isolated PostgreSQL', () => {
  beforeAll(async () => {
    const target = (
      await query(
        'SELECT s.id::text,ep.public_id,s.event_id::text,s.layout_id::text FROM event_sessions s JOIN event_publications ep ON ep.event_id=s.event_id ORDER BY s.id LIMIT 1',
      )
    ).rows[0];
    sessionId = target.id;
    eventId = target.event_id;
    publicId = target.public_id;
    await query(
      "UPDATE event_sessions SET starts_at=now()+interval '1 hour',ends_at=now()+interval '4 hours',sale_opens_at=now()-interval '1 day',sale_closes_at=now()+interval '30 minutes',counter_opens_at=now()-interval '1 hour',counter_closes_at=now()+interval '2 hours',admission_opens_at=now()-interval '1 hour',admission_closes_at=now()+interval '3 hours' WHERE id=$1",
      [sessionId],
    );
    await query('UPDATE events SET minimum_age=18 WHERE id=$1', [eventId]);
    const section = (
      await query(
        "INSERT INTO layout_sections(layout_id,code,name) VALUES($1,'TEST','Fixture') RETURNING id",
        [target.layout_id],
      )
    ).rows[0];
    const row = (
      await query(
        "INSERT INTO layout_rows(section_id,layout_id,code) VALUES($1,$2,'A') RETURNING id",
        [section.id, target.layout_id],
      )
    ).rows[0];
    const type = (
      await query(
        "INSERT INTO ticket_types(session_id,code,name) VALUES($1,'FIXTURE','Fixture') RETURNING id",
        [sessionId],
      )
    ).rows[0];
    for (let i = 1; i <= 60; i++) {
      const seat = (
        await query(
          'INSERT INTO seats(row_id,layout_id,number,map_x,map_y,width,height) VALUES($1,$2,$3,1,1,1,1) RETURNING id',
          [row.id, target.layout_id, String(i)],
        )
      ).rows[0];
      await query(
        "INSERT INTO session_seats(session_id,seat_id,layout_id,ticket_type_id,price_minor,currency) VALUES($1,$2,$3,$4,10000,'VND')",
        [sessionId, seat.id, target.layout_id, type.id],
      );
    }
    const owner = (
      await query(
        'SELECT o.applicant_user_id::text,o.company_identity_id::text FROM events e JOIN organizations o ON o.id=e.organization_id WHERE e.id=$1',
        [eventId],
      )
    ).rows[0];
    staff = await session(owner.applicant_user_id, owner.company_identity_id);
    otherStaff = await session('900102', '901102');
  }, 20000);
  afterAll(async () => {
    await pool.end();
  });
  it('requires full per-ticket credentials and rejects young attendees', async () => {
    const b = await booking(3, false);
    await expect(
      payments.start(b.actor, b.order.id, randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ code: 'ATTENDEE_CREDENTIALS_REQUIRED' });
    await expect(
      saveAttendees(b.actor, b.order.id, b.attendeeRows.slice(0, 2), randomUUID()),
    ).rejects.toMatchObject({ code: 'ATTENDEE_SET_MISMATCH' });
    await expect(
      saveAttendees(
        b.actor,
        b.order.id,
        b.attendeeRows.map((a) => ({ ...a, dateOfBirth: '2020-01-01' })),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'ATTENDEE_TOO_YOUNG' });
    expect(
      (await query('SELECT count(*)::int AS n FROM payments WHERE booking_id=$1', [b.order.id]))
        .rows[0].n,
    ).toBe(0);
  });
  it('reuses payment and provider order on retry, rejects other owner and locks attendee edits', async () => {
    const b = await booking(),
      key = randomUUID();
    const p = await payments.start(b.actor, b.order.id, key, randomUUID());
    expect((await payments.start(b.actor, b.order.id, key, randomUUID())).id).toBe(p.id);
    expect((await payments.start(b.actor, b.order.id, randomUUID(), randomUUID())).id).toBe(p.id);
    await expect(payments.get(await customer(), p.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      saveAttendees(b.actor, b.order.id, b.attendeeRows, randomUUID()),
    ).rejects.toMatchObject({ code: 'ATTENDEES_LOCKED' });
  });
  it('recovers when provider creates a link but response times out', async () => {
    const b = await booking();
    gateway.timeoutAfterCreate = true;
    try {
      const p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID());
      expect(p.checkoutUrl).toBeTruthy();
    } finally {
      gateway.timeoutAfterCreate = false;
    }
  });
  it('keeps durable outbox on provider failure and recovers without changing payment', async () => {
    const b = await booking();
    gateway.unavailable = true;
    let p;
    try {
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID());
      expect(p.checkoutUrl).toBeNull();
    } finally {
      gateway.unavailable = false;
    }
    await query(
      "UPDATE outbox_messages SET available_at=now()-interval '1 second' WHERE aggregate_type='PAYMENT' AND aggregate_id=$1",
      [p.id],
    );
    await payments.createLink(p.id);
    expect((await payments.get(b.actor, p.id)).checkoutUrl).toBeTruthy();
  });
  it('issues one ticket per attendee exactly once for concurrent duplicate callbacks', async () => {
    const b = await booking(3),
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID()),
      r = await receipt(p.id);
    await Promise.all([payments.accept(r), payments.accept(r), payments.accept(r)]);
    expect(await state(b.order.id)).toEqual({ status: 'CONFIRMED', tickets: 3 });
    expect(
      (await query('SELECT received_minor::text FROM payments WHERE id=$1', [p.id])).rows[0]
        .received_minor,
    ).toBe('30000');
    expect(
      (await tickets.list(b.actor, b.order.id)).every((t) =>
        /^EVX-[A-F0-9]{32}$/.test(t.ticketCode ?? ''),
      ),
    ).toBe(true);
    await expect(
      tickets.list(await customer(), undefined, (await tickets.list(b.actor, b.order.id))[0]!.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('rolls back confirmation and issuance together and retries durable inbox', async () => {
    const b = await booking(),
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID()),
      r = await receipt(p.id);
    const broken: TicketIssuer = {
      async issue() {
        throw new Error('Issuance unavailable');
      },
    };
    const failing = new PaymentService(gateway, port, broken, 'http://127.0.0.1:5173');
    await expect(failing.accept(r)).rejects.toThrow('Issuance unavailable');
    expect(await state(b.order.id)).toEqual({ status: 'AWAITING_PAYMENT', tickets: 0 });
    expect(
      (await query('SELECT received_minor::text FROM payments WHERE id=$1', [p.id])).rows[0]
        .received_minor,
    ).toBe('0');
    await payments.accept(r);
    expect(await state(b.order.id)).toEqual({ status: 'CONFIRMED', tickets: 1 });
  });
  it('accumulates partial receipts, deduplicates reference and issues only at exact amount', async () => {
    const b = await booking(),
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID()),
      r = await receipt(p.id, '4000');
    await payments.accept(r);
    await payments.accept(r);
    expect(await state(b.order.id)).toEqual({ status: 'AWAITING_PAYMENT', tickets: 0 });
    await payments.accept(await receipt(p.id, '6000'));
    expect(await state(b.order.id)).toEqual({ status: 'CONFIRMED', tickets: 1 });
    expect((await payments.get(b.actor, p.id)).reconciliationStatus).toBe('NONE');
  });
  it('records overpayment for reconciliation without issuing tickets', async () => {
    const b = await booking(),
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID());
    await payments.accept(await receipt(p.id, '11000'));
    expect(await state(b.order.id)).toEqual({ status: 'AWAITING_PAYMENT', tickets: 0 });
    expect((await payments.get(b.actor, p.id)).reconciliationReason).toBe('OVERPAYMENT');
  });
  it('records money after cancellation without reviving seats or tickets', async () => {
    const b = await booking(),
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID());
    await cancelBooking(b.actor, b.order.id, 'Fixture cancellation', randomUUID(), randomUUID());
    await payments.accept(await receipt(p.id));
    expect(await state(b.order.id)).toEqual({ status: 'CANCELLED', tickets: 0 });
    expect((await payments.get(b.actor, p.id)).reconciliationStatus).toBe('REQUIRED');
    expect(
      (
        await query('SELECT status FROM session_seats WHERE id=$1', [
          b.order.items[0]!.sessionSeatId,
        ])
      ).rows[0].status,
    ).toBe('AVAILABLE');
  });
  it('rejects receipt mismatch and keeps booking unchanged', async () => {
    const b = await booking(),
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID());
    await payments.accept({ ...(await receipt(p.id)), paymentLinkId: 'wrong-link' });
    expect(await state(b.order.id)).toEqual({ status: 'AWAITING_PAYMENT', tickets: 0 });
    expect((await payments.get(b.actor, p.id)).receivedMinor).toBe('0');
  });
  it('late money cannot take a seat already held by another customer', async () => {
    const b = await booking(),
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID());
    await query(
      "UPDATE seat_holds SET created_at=now()-interval '10 minutes',expires_at=now()-interval '1 second' WHERE id=(SELECT hold_id FROM bookings WHERE id=$1)",
      [b.order.id],
    );
    await query("UPDATE bookings SET expires_at=now()-interval '1 second' WHERE id=$1", [
      b.order.id,
    ]);
    await query(
      "UPDATE session_seats SET hold_expires_at=now()-interval '1 second' WHERE current_booking_id=$1",
      [b.order.id],
    );
    const holdId = (await query('SELECT hold_id::text FROM bookings WHERE id=$1', [b.order.id]))
      .rows[0].hold_id;
    await expireAllocation(holdId);
    const next = await customer(),
      nextHold = await createHold(
        next,
        publicId,
        sessionId,
        [b.order.items[0]!.sessionSeatId],
        randomUUID(),
        randomUUID(),
        async () => {},
      );
    await payments.accept(await receipt(p.id));
    expect(await state(b.order.id)).toEqual({ status: 'EXPIRED', tickets: 0 });
    expect(
      (
        await query('SELECT hold_id::text,status FROM session_seats WHERE id=$1', [
          b.order.items[0]!.sessionSeatId,
        ])
      ).rows[0],
    ).toEqual({ hold_id: nextHold.data.id, status: 'HELD' });
  });
  it('authenticated provider polling recovers a missed callback', async () => {
    const b = await booking(),
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID()),
      r = await receipt(p.id);
    gateway.receipts.set(Number(r.orderCode), [r]);
    await query('UPDATE payments SET last_polled_at=CASE WHEN id=$1 THEN NULL ELSE now() END', [
      p.id,
    ]);
    await payments.recover();
    expect(await state(b.order.id)).toEqual({ status: 'CONFIRMED', tickets: 1 });
  });
  it('counter check-in and admission replay are idempotent', async () => {
    const b = await booking(),
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID());
    await payments.accept(await receipt(p.id));
    const t = (await tickets.list(b.actor, b.order.id))[0]!,
      checkKey = randomUUID(),
      admitKey = randomUUID();
    const check = { ticketCode: t.ticketCode!, attendeeName: t.attendeeName };
    await tickets.checkIn(staff, sessionId, check, checkKey, randomUUID(), 'COUNTER');
    await tickets.checkIn(staff, sessionId, check, checkKey, randomUUID(), 'COUNTER');
    const attendee = b.attendeeRows[0]!,
      proof = {
        ticketCode: t.ticketCode!,
        cccd: attendee.cccd,
        fullName: attendee.fullName,
        dateOfBirth: attendee.dateOfBirth,
        physicalDocumentSeen: true as const,
      };
    await tickets.admit(staff, sessionId, proof, admitKey, randomUUID());
    expect(await tickets.admit(staff, sessionId, proof, admitKey, randomUUID())).toEqual({
      ticketId: t.id,
      status: 'USED',
    });
    expect(
      (await query('SELECT count(*)::int AS n FROM check_ins WHERE ticket_id=$1', [t.id])).rows[0]
        .n,
    ).toBe(1);
  });
  it('counter/online check-in stays VALID; physical proof and admission consume ticket once', async () => {
    const b = await booking(),
      p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID());
    await payments.accept(await receipt(p.id));
    const t = (await tickets.list(b.actor, b.order.id))[0]!;
    const proof = {
      ticketCode: t.ticketCode!,
      cccd: b.attendeeRows[0]!.cccd,
      fullName: b.attendeeRows[0]!.fullName,
      dateOfBirth: b.attendeeRows[0]!.dateOfBirth,
      physicalDocumentSeen: true as const,
    };
    await expect(tickets.lookup(otherStaff, sessionId, t.ticketCode!)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      tickets.admit(staff, sessionId, proof, randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ code: 'CHECK_IN_REQUIRED' });
    await tickets.checkIn(
      b.actor,
      t.id,
      { ticketCode: t.ticketCode!, attendeeName: t.attendeeName },
      randomUUID(),
      randomUUID(),
      'ONLINE',
    );
    expect((await tickets.list(b.actor, b.order.id))[0]!.status).toBe('VALID');
    await expect(
      tickets.admit(
        staff,
        sessionId,
        { ...proof, cccd: '999999999999' },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'ATTENDEE_IDENTITY_MISMATCH' });
    const results = await Promise.allSettled([
      tickets.admit(staff, sessionId, proof, randomUUID(), randomUUID()),
      tickets.admit(staff, sessionId, proof, randomUUID(), randomUUID()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await tickets.list(b.actor, b.order.id))[0]).toMatchObject({
      status: 'USED',
      ticketCode: null,
    });
  });
  it('HTTP requires valid origin/auth/key and never trusts redirect query status', async () => {
    const b = await booking();
    const token = await accessToken({
      userId: b.actor.id,
      identityId: '0',
      displayName: 'Fixture',
      authVersion: 0,
      sessionId: b.actor.sessionId,
      refreshToken: '',
      expiresAt: new Date(Date.now() + 60000),
    });
    const app = createApp({ checkDatabase: async () => {}, paymentGateway: gateway });
    await request(app)
      .post(`/api/v1/bookings/${b.order.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'https://wrong.invalid')
      .send({})
      .expect(403);
    await request(app)
      .post(`/api/v1/bookings/${b.order.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', env.PUBLIC_APP_URL!)
      .send({})
      .expect(400);
    await request(app)
      .get(`/api/v1/bookings/${b.order.id}?status=PAID&code=00`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .then((res) => expect(res.body.data.status).toBe('AWAITING_PAYMENT'));
  });
  it.skipIf(process.env.COMMERCE_TEST_BROWSER !== '1')(
    'browser completes three attendees, return, QR, counter check-in and physical admission',
    async () => {
      vi.spyOn(roomRepository, 'requireRoomAdmission').mockResolvedValue(undefined);
      vi.spyOn(roomService, 'waitingRoom').mockResolvedValue({
        status: 'ADMITTED',
        position: null,
        admissionExpiresAt: new Date(Date.now() + 600000),
        waiting: 0,
        active: 1,
        serverTime: new Date(),
        pollAfterSeconds: 30,
      });
      const actor = await customer();
      const app = createApp({
        checkDatabase: async () => {},
        catalogRepository: postgresCatalogRepository,
        paymentGateway: gateway,
      });
      let orderId = '';
      await runCommerceBrowser({
        app,
        origin: env.PUBLIC_APP_URL!,
        publicId,
        sessionId,
        async refreshCookie(role) {
          const current = role === 'customer' ? actor : staff;
          const raw = randomBytes(32).toString('base64url');
          const { createHash } = await import('node:crypto');
          await query(
            "INSERT INTO refresh_tokens(session_id,token_hash,expires_at) VALUES($1,$2,now()+interval '6 days')",
            [current.sessionId, createHash('sha256').update(raw).digest()],
          );
          return raw;
        },
        async pay() {
          const p = (
            await query(
              'SELECT id::text,booking_id::text FROM payments WHERE booking_id IN(SELECT id FROM bookings WHERE customer_id=$1) ORDER BY id DESC LIMIT 1',
              [actor.id],
            )
          ).rows[0];
          orderId = p.booking_id;
          await payments.accept(await receipt(p.id));
          return orderId;
        },
        async ticket() {
          return (await tickets.list(actor, orderId))[0]!.ticketCode!;
        },
      });
      expect(await state(orderId)).toEqual({ status: 'CONFIRMED', tickets: 3 });
      expect((await tickets.list(actor, orderId)).filter((t) => t.status === 'USED')).toHaveLength(
        1,
      );
    },
    60000,
  );
});
