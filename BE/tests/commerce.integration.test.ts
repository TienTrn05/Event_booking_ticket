import { RefundService } from '../src/modules/refunds/refund.service.js';
import { FeedbackService } from '../src/modules/feedback/feedback.service.js';
import { refundResult } from '../src/modules/refunds/refund.schema.js';
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
    await query(
      "INSERT INTO users(display_name,gender,date_of_birth,registration_role,onboarding_completed_at) VALUES('Commerce fixture','UNDISCLOSED','1990-01-02','CUSTOMER',now()) RETURNING id::text",
    )
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
        'SELECT s.id::text,e.public_id,s.event_id::text,s.layout_id::text FROM event_sessions s JOIN events e ON e.id=s.event_id ORDER BY s.id LIMIT 1',
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
        'SELECT o.applicant_user_id::text,o.applicant_identity_id::text FROM events e JOIN organizations o ON o.id=e.organization_id WHERE e.id=$1',
        [eventId],
      )
    ).rows[0];
    staff = await session(owner.applicant_user_id, owner.applicant_identity_id);
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
      const admin = await customer();
      await query(
        `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'`,
        [admin.id],
      );
      await query(
        `UPDATE users SET registration_role=NULL,onboarding_completed_at=NULL,gender=NULL,date_of_birth=NULL WHERE id=$1`,
        [actor.id],
      );
      await query(`DELETE FROM user_roles WHERE user_id=$1`, [actor.id]);
      await query(
        `UPDATE users SET registration_role='ORGANIZER',onboarding_completed_at=clock_timestamp(),gender='UNDISCLOSED',date_of_birth='1990-01-02' WHERE id=$1`,
        [staff.id],
      );
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
          const current = role === 'customer' ? actor : role === 'admin' ? admin : staff;
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
      const answers = (await query('SELECT onboarding_answers FROM users WHERE id=$1', [actor.id]))
        .rows[0].onboarding_answers as Record<string, string>;
      expect(Object.values(answers)).toEqual(['Học tổ chức sự kiện']);
      await query(`UPDATE onboarding_questionnaires SET status='ARCHIVED' WHERE status='ACTIVE'`);
      await query(`UPDATE onboarding_questionnaires SET status='ACTIVE' WHERE id=1`);
      expect((await tickets.list(actor, orderId)).filter((t) => t.status === 'USED')).toHaveLength(
        1,
      );
    },
    60000,
  );

  async function paidRefundFixture() {
    await query(
      "UPDATE event_sessions SET starts_at=now()+interval '3 days',ends_at=now()+interval '4 days',sale_opens_at=now()-interval '1 day',sale_closes_at=now()+interval '30 minutes',counter_opens_at=now()-interval '1 hour',counter_closes_at=now()+interval '2 hours',admission_opens_at=now()-interval '1 hour',admission_closes_at=now()+interval '3 hours' WHERE id=$1",
      [sessionId],
    );
    for (const actor of [staff, otherStaff])
      await query(
        "UPDATE users SET gender='UNDISCLOSED',date_of_birth='1990-01-02',registration_role='ORGANIZER',onboarding_completed_at=now() WHERE id=$1",
        [actor.id],
      );
    const b = await booking(2);
    const p = await payments.start(b.actor, b.order.id, randomUUID(), randomUUID());
    const received = await receipt(p.id);
    await payments.accept(received);
    return { ...b, p, received };
  }
  async function adminFixture() {
    const actor = await customer();
    await query(
      "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
      [actor.id],
    );
    return actor;
  }
  it('full manual refund revokes tickets, preserves sold seats, retries and cannot be revived by receipts', async () => {
    const refunds = new RefundService(),
      b = await paidRefundFixture(),
      key = randomUUID();
    const r = (await refunds.request(b.actor, b.order.id, 'Fixture reason', key, randomUUID()))!;
    expect(
      (await refunds.request(b.actor, b.order.id, 'Fixture reason', key, randomUUID()))!.id,
    ).toBe(r.id);
    await expect(
      refunds.request(b.actor, b.order.id, 'Another request', randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ code: 'REFUND_EXISTS' });
    await expect(refunds.get(await customer(), r.id, 'self')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      refunds.change(
        otherStaff,
        r.id,
        'approve',
        { version: 0, reason: 'Fixture decision' },
        'organization',
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const approveKey = randomUUID(),
      approved = (await refunds.change(
        staff,
        r.id,
        'approve',
        { version: 0, reason: 'Fixture decision' },
        'organization',
        approveKey,
        randomUUID(),
      ))!;
    expect(approved.status).toBe('PROCESSING');
    expect(
      (await refunds.change(
        staff,
        r.id,
        'approve',
        { version: 0, reason: 'Fixture decision' },
        'organization',
        approveKey,
        randomUUID(),
      ))!.version,
    ).toBe(1);
    expect(
      (await tickets.list(b.actor, b.order.id)).every(
        (t) => t.status === 'CANCELLED' && !t.ticketCode,
      ),
    ).toBe(true);
    const failed = (await refunds.change(
      staff,
      r.id,
      'result',
      { version: 1, status: 'FAILED', reason: 'Fixture transfer failed' },
      'organization',
      randomUUID(),
      randomUUID(),
    ))!;
    expect(failed.status).toBe('FAILED');
    const retry = (await refunds.change(
      staff,
      r.id,
      'retry',
      { version: failed.version, reason: 'Fixture retry' },
      'organization',
      randomUUID(),
      randomUUID(),
    ))!;
    const invalid = {
      version: retry.version,
      status: 'SUCCESS' as const,
      reference: 'invalid-time',
      evidenceNote: 'Fixture bank receipt only',
      transferredAt: '2099-01-01T00:00:00Z',
    };
    await expect(
      refunds.change(staff, r.id, 'result', invalid, 'organization', randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSFER_TIME' });
    const input = refundResult.parse({
        ...invalid,
        reference: randomUUID(),
        transferredAt: new Date().toISOString(),
      }),
      resultKey = randomUUID();
    expect(
      (await refunds.change(staff, r.id, 'result', input, 'organization', resultKey, randomUUID()))!
        .status,
    ).toBe('SUCCESS');
    expect(
      (await refunds.change(staff, r.id, 'result', input, 'organization', resultKey, randomUUID()))!
        .status,
    ).toBe('SUCCESS');
    expect((await state(b.order.id)).status).toBe('REFUNDED');
    expect((await tickets.list(b.actor, b.order.id)).every((t) => t.status === 'REFUNDED')).toBe(
      true,
    );
    expect(
      (
        await query('SELECT DISTINCT status FROM session_seats WHERE current_booking_id=$1', [
          b.order.id,
        ])
      ).rows,
    ).toEqual([{ status: 'SOLD' }]);
    await payments.accept(b.received);
    await payments.accept({ ...b.received, reference: randomUUID(), amount: '1' });
    const payment = (
      await query(
        'SELECT status,reconciliation_status,reconciliation_reason FROM payments WHERE id=$1',
        [b.p.id],
      )
    ).rows[0];
    expect(payment).toEqual({
      status: 'REFUNDED',
      reconciliation_status: 'REQUIRED',
      reconciliation_reason: 'FUNDS_AFTER_REFUND',
    });
    expect((await state(b.order.id)).status).toBe('REFUNDED');
  });
  it('enforces 24-hour request deadline and serializes refund approval against physical admission', async () => {
    const refunds = new RefundService(),
      b = await paidRefundFixture();
    await query("UPDATE event_sessions SET starts_at=now()+interval '23 hours' WHERE id=$1", [
      sessionId,
    ]);
    await expect(
      refunds.request(b.actor, b.order.id, 'Fixture reason', randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ code: 'REFUND_DEADLINE_PASSED' });
    await query("UPDATE event_sessions SET starts_at=now()+interval '3 days' WHERE id=$1", [
      sessionId,
    ]);
    const r = (await refunds.request(
      b.actor,
      b.order.id,
      'Fixture reason',
      randomUUID(),
      randomUUID(),
    ))!;
    const owned = (await tickets.list(b.actor, b.order.id))[0]!,
      person = b.attendeeRows[0]!;
    await tickets.checkIn(
      staff,
      sessionId,
      { ticketCode: owned.ticketCode!, attendeeName: person.fullName },
      randomUUID(),
      randomUUID(),
      'COUNTER',
    );
    const outcomes = await Promise.allSettled([
      refunds.change(
        staff,
        r.id,
        'approve',
        { version: 0, reason: 'Fixture approval' },
        'organization',
        randomUUID(),
        randomUUID(),
      ),
      tickets.admit(
        staff,
        sessionId,
        {
          ticketCode: owned.ticketCode!,
          fullName: person.fullName,
          dateOfBirth: person.dateOfBirth,
          cccd: person.cccd,
          physicalDocumentSeen: true,
        },
        randomUUID(),
        randomUUID(),
      ),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    const states = (await tickets.list(b.actor, b.order.id)).map((t) => t.status);
    expect(states.every((s) => s === 'CANCELLED') || states.includes('USED')).toBe(true);
  });
  it('Admin refund access requires an assigned open report bound to the exact booking', async () => {
    const refunds = new RefundService(),
      b = await paidRefundFixture(),
      admin = await adminFixture(),
      other = await adminFixture();
    const r = (await refunds.request(
      b.actor,
      b.order.id,
      'Fixture reason',
      randomUUID(),
      randomUUID(),
    ))!;
    await expect(refunds.get(admin, r.id, 'admin')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const report = await refunds.createReport(
      b.actor,
      b.order.id,
      'Fixture dispute',
      randomUUID(),
      randomUUID(),
    );
    await refunds.claimReport(admin, report.id, randomUUID(), randomUUID());
    await expect(refunds.get(other, r.id, 'admin', report.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(
      (await refunds.change(
        admin,
        r.id,
        'approve',
        { version: 0, reason: 'Report decision', reportId: report.id },
        'admin',
        randomUUID(),
        randomUUID(),
      ))!.status,
    ).toBe('PROCESSING');
    expect(
      (
        await query(
          "SELECT support_report_id::text FROM audit_logs WHERE actor_id=$1 AND resource_type='REFUND' AND resource_id=$2 AND action='refund.approve'",
          [admin.id, r.id],
        )
      ).rows[0].support_report_id,
    ).toBe(report.id);
    await refunds.closeReport(admin, report.id, 1, 'Fixture resolved', randomUUID(), randomUUID());
    await expect(refunds.get(admin, r.id, 'admin', report.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
  it('verified organization reviews are private, unique, editable for seven days and keep moderation history', async () => {
    const feedback = new FeedbackService(),
      b = await paidRefundFixture(),
      admin = await adminFixture();
    const input = { kind: 'ORGANIZATION' as const, eventId, stars: 4, content: 'Fixture review' };
    await expect(feedback.create(b.actor, input, randomUUID(), randomUUID())).rejects.toMatchObject(
      { code: 'REVIEW_NOT_ELIGIBLE' },
    );
    await query(
      "UPDATE event_sessions SET starts_at=now()-interval '4 hours',ends_at=now()-interval '1 hour',sale_closes_at=now()-interval '5 hours',counter_opens_at=now()-interval '5 hours',counter_closes_at=now()-interval '3 hours',admission_opens_at=now()-interval '4 hours',admission_closes_at=now()-interval '1 hour' WHERE id=$1",
      [sessionId],
    );
    const key = randomUUID(),
      review = (await feedback.create(b.actor, input, key, randomUUID()))!;
    expect((await feedback.create(b.actor, input, key, randomUUID()))!.id).toBe(review.id);
    await expect(feedback.create(b.actor, input, randomUUID(), randomUUID())).rejects.toMatchObject(
      { code: 'REVIEW_EXISTS' },
    );
    await expect(feedback.get(await customer(), review.id, 'self')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(feedback.get(otherStaff, review.id, 'organization')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect((await feedback.get(admin, review.id, 'admin')).stars).toBe(4);
    const edited = (await feedback.change(
      b.actor,
      review.id,
      'edit',
      { version: 0, stars: 5, content: 'Updated fixture' },
      randomUUID(),
      randomUUID(),
    ))!;
    const reply = (await feedback.change(
      staff,
      review.id,
      'reply',
      { version: edited.version, reply: 'Fixture reply' },
      randomUUID(),
      randomUUID(),
    ))!;
    const hidden = (await feedback.change(
      admin,
      review.id,
      'moderate',
      { version: reply.version, hidden: true, reason: 'Fixture moderation' },
      randomUUID(),
      randomUUID(),
    ))!;
    expect(hidden.status).toBe('HIDDEN');
    expect(
      (await feedback.list(staff, 'organization', review.organization_id, 1, 20)).summary?.count,
    ).toBe(0);
    const history = (
      await query('SELECT jsonb_array_length(history)::int AS n FROM feedback WHERE id=$1', [
        review.id,
      ])
    ).rows[0].n;
    expect(history).toBe(3);
    await query("UPDATE feedback SET created_at=now()-interval '8 days' WHERE id=$1", [review.id]);
    await expect(
      feedback.change(
        b.actor,
        review.id,
        'edit',
        { version: hidden.version, stars: 3, content: 'Late fixture' },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'REVIEW_EDIT_CLOSED' });
  });
  it('app feedback is restricted to its author and Admin, never Organizer or other customers', async () => {
    const feedback = new FeedbackService(),
      author = await customer(),
      admin = await adminFixture();
    const row = (await feedback.create(
      author,
      { kind: 'SYSTEM', category: 'PERFORMANCE', content: 'Fixture slow page' },
      randomUUID(),
      randomUUID(),
    ))!;
    expect(row.stars).toBeNull();
    await expect(feedback.get(staff, row.id, 'organization')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(feedback.get(await customer(), row.id, 'self')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(feedback.list(staff, 'admin', null, 1, 20)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const handled = (await feedback.change(
      admin,
      row.id,
      'handle',
      { version: 0, reply: 'Fixture issue resolved', status: 'RESOLVED' },
      randomUUID(),
      randomUUID(),
    ))!;
    expect(handled.status).toBe('RESOLVED');
    expect((await feedback.get(author, row.id, 'self')).reply).toBe('Fixture issue resolved');
    const app = createApp({ checkDatabase: async () => {}, paymentGateway: gateway });
    const token = await accessToken({
      userId: author.id,
      identityId: '0',
      displayName: 'Fixture',
      authVersion: author.authVersion,
      sessionId: author.sessionId,
      refreshToken: '',
      expiresAt: new Date(Date.now() + 60000),
    });
    expect(
      (
        await request(app)
          .get('/api/v1/users/me/feedback')
          .set('Authorization', 'Bearer ' + token)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/v1/feedback')
          .set('Authorization', 'Bearer ' + token)
          .set('Idempotency-Key', randomUUID())
          .send({ kind: 'SYSTEM', category: 'BUG', content: 'Fixture issue' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/feedback')
          .set('Authorization', 'Bearer ' + token)
          .set('Origin', env.PUBLIC_APP_URL!)
          .set('Idempotency-Key', randomUUID())
          .send({ kind: 'SYSTEM', category: 'BUG', content: 'Fixture issue', authorId: staff.id })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get('/api/v1/admin/feedback')
          .set('Authorization', 'Bearer ' + token)
      ).status,
    ).toBe(403);
    const created = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', 'Bearer ' + token)
      .set('Origin', env.PUBLIC_APP_URL!)
      .set('Idempotency-Key', randomUUID())
      .send({ kind: 'SYSTEM', category: 'BUG', content: 'Fixture issue via API', stars: 2 });
    expect(created.status).toBe(201);
    expect(created.body.data.kind).toBe('SYSTEM');
  });
  it('rejecting a refund preserves tickets, allows a new request, and USED tickets cannot be refunded', async () => {
    const refunds = new RefundService(),
      b = await paidRefundFixture();
    const r = (await refunds.request(
      b.actor,
      b.order.id,
      'Fixture request',
      randomUUID(),
      randomUUID(),
    ))!;
    expect(
      (await refunds.change(
        staff,
        r.id,
        'reject',
        { version: 0, reason: 'Fixture rejection' },
        'organization',
        randomUUID(),
        randomUUID(),
      ))!.status,
    ).toBe('REJECTED');
    expect((await tickets.list(b.actor, b.order.id)).every((t) => t.status === 'VALID')).toBe(true);
    const newRequest = (await refunds.request(
      b.actor,
      b.order.id,
      'New fixture request',
      randomUUID(),
      randomUUID(),
    ))!;
    expect(newRequest.id).not.toBe(r.id);
    const other = await paidRefundFixture(),
      t = (await tickets.list(other.actor, other.order.id))[0]!,
      person = other.attendeeRows[0]!;
    await tickets.checkIn(
      staff,
      sessionId,
      { ticketCode: t.ticketCode!, attendeeName: person.fullName },
      randomUUID(),
      randomUUID(),
      'COUNTER',
    );
    await tickets.admit(
      staff,
      sessionId,
      {
        ticketCode: t.ticketCode!,
        fullName: person.fullName,
        dateOfBirth: person.dateOfBirth,
        cccd: person.cccd,
        physicalDocumentSeen: true,
      },
      randomUUID(),
      randomUUID(),
    );
    await expect(
      refunds.request(
        other.actor,
        other.order.id,
        'Used ticket request',
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'REFUND_TICKET_NOT_VALID' });
  });
  it('a manual transfer reference cannot complete two refunds, including concurrent recordings', async () => {
    const refunds = new RefundService(),
      first = await paidRefundFixture(),
      second = await paidRefundFixture();
    const requests = [];
    for (const b of [first, second]) {
      const r = (await refunds.request(
        b.actor,
        b.order.id,
        'Fixture reason',
        randomUUID(),
        randomUUID(),
      ))!;
      requests.push(
        (await refunds.change(
          staff,
          r.id,
          'approve',
          { version: 0, reason: 'Fixture approval' },
          'organization',
          randomUUID(),
          randomUUID(),
        ))!,
      );
    }
    const reference = randomUUID(),
      transferredAt = new Date().toISOString();
    const results = await Promise.allSettled(
      requests.map((r) =>
        refunds.change(
          staff,
          r.id,
          'result',
          {
            version: 1,
            status: 'SUCCESS',
            reference,
            evidenceNote: 'Fixture receipt reference only',
            transferredAt,
          },
          'organization',
          randomUUID(),
          randomUUID(),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((r) => r.status === 'rejected');
    expect(failure?.status === 'rejected' && failure.reason).toMatchObject({
      code: 'REFUND_REFERENCE_EXISTS',
    });
    const states = await Promise.all([state(first.order.id), state(second.order.id)]);
    expect(states.map((s) => s.status).sort()).toEqual(['CONFIRMED', 'REFUNDED']);
  });
  it('a paid customer can review a cancelled event without check-in, but an unrelated account cannot', async () => {
    const feedback = new FeedbackService(),
      b = await paidRefundFixture();
    await query("UPDATE events SET status='CANCELLED' WHERE id=$1", [eventId]);
    try {
      await expect(
        feedback.create(
          await customer(),
          { kind: 'ORGANIZATION', eventId, stars: 1, content: 'No purchase fixture' },
          randomUUID(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'REVIEW_NOT_ELIGIBLE' });
      expect(
        (await feedback.create(
          b.actor,
          { kind: 'ORGANIZATION', eventId, stars: 2, content: 'Cancelled event fixture' },
          randomUUID(),
          randomUUID(),
        ))!.stars,
      ).toBe(2);
    } finally {
      await query("UPDATE events SET status='PUBLISHED' WHERE id=$1", [eventId]);
    }
  });
  it('checkout accepts multiple BIGINT seat IDs across a digit boundary in either input order', async () => {
    await query(
      "UPDATE event_sessions SET starts_at=now()+interval '3 days',ends_at=now()+interval '4 days',sale_opens_at=now()-interval '1 day',sale_closes_at=now()+interval '30 minutes' WHERE id=$1",
      [sessionId],
    );
    const context = (
      await query(
        'SELECT ss.layout_id,ss.ticket_type_id,s.row_id FROM session_seats ss JOIN seats s ON s.id=ss.seat_id WHERE ss.session_id=$1 LIMIT 1',
        [sessionId],
      )
    ).rows[0];
    for (const id of ['900099', '900100']) {
      const seat = (
        await query(
          'INSERT INTO seats(row_id,layout_id,number,map_x,map_y,width,height) VALUES($1,$2,$3,1,1,1,1) RETURNING id',
          [context.row_id, context.layout_id, 'B' + id],
        )
      ).rows[0];
      await query(
        "INSERT INTO session_seats(id,session_id,seat_id,layout_id,ticket_type_id,price_minor,currency) VALUES($1,$2,$3,$4,$5,10000,'VND')",
        [id, sessionId, seat.id, context.layout_id, context.ticket_type_id],
      );
    }
    const actor = await customer(),
      hold = await createHold(
        actor,
        publicId,
        sessionId,
        ['900100', '900099'],
        randomUUID(),
        randomUUID(),
        async () => {},
      );
    const result = await createBooking(
      actor,
      {
        holdId: hold.data.id,
        attendees: [
          { sessionSeatId: '900100', attendeeName: 'Second fixture' },
          { sessionSeatId: '900099', attendeeName: 'First fixture' },
        ],
      },
      randomUUID(),
      randomUUID(),
    );
    expect(result.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionSeatId: '900099', attendeeName: 'First fixture' }),
        expect.objectContaining({ sessionSeatId: '900100', attendeeName: 'Second fixture' }),
      ]),
    );
  });
});
