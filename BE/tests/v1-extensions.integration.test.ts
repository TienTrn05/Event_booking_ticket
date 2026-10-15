import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { databaseTimestamp } from './fixtures/database-time.js';
import request from 'supertest';
import { pool } from '../src/shared/database/pool.js';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { accessToken } from '../src/modules/auth/session/session.service.js';
import type { RequestActor } from '../src/shared/auth/request-actor.js';
import { MerchandiseService } from '../src/modules/merchandise/merchandise.service.js';
import { MerchandiseRefundService } from '../src/modules/merchandise/merchandise-refund.service.js';
import { productInput, orderInput } from '../src/modules/merchandise/merchandise.schema.js';
import { PaymentService } from '../src/modules/payments/application/payment.service.js';
import { PaymentRepository } from '../src/modules/payments/repositories/payment.repository.js';
import { BookingPaymentAdapter } from '../src/modules/bookings/payments/booking-payment.adapter.js';
import { DatabaseTicketIssuer } from '../src/modules/tickets/issuance/ticket-issuer.js';
import { MerchandisePaymentAdapter } from '../src/modules/merchandise/merchandise-payment.adapter.js';
import { SaleChangeService } from '../src/modules/events/sales-changes/sale-change.service.js';
import { saleChangeInput } from '../src/modules/events/sales-changes/sale-change.schema.js';
import { SupportReportService } from '../src/modules/support-reports/support-report.service.js';
import { refundResult } from '../src/modules/refunds/refund.schema.js';
import { createHold, releaseHold } from '../src/modules/bookings/holds/hold.service.js';
import { createBooking } from '../src/modules/bookings/orders/booking-command.service.js';
import { saveAttendees } from '../src/modules/tickets/attendees/attendee.service.js';
import { attendeesInput } from '../src/modules/tickets/attendees/attendee.schema.js';
import { uid, v1Account, v1Organization, v1Event, V1Gateway } from './fixtures/v1-extensions.js';
import { withTransaction } from '../src/shared/database/transaction.js';
import { mediaRepository } from '../src/modules/media/repositories/media.repository.js';
import { OperationsService } from '../src/modules/operations/operations.service.js';
import { statisticsQuery } from '../src/modules/operations/operations.schema.js';
import { EventOperationsService } from '../src/modules/events/operations/event-operations.service.js';
describe.skipIf(!process.env.COMMERCE_TEST_DB_PORT)(
  'v1 merchandise and sale extensions on PostgreSQL',
  () => {
    const service = new MerchandiseService(),
      refunds = new MerchandiseRefundService(),
      sales = new SaleChangeService(),
      reports = new SupportReportService(),
      gateway = new V1Gateway(),
      issue = vi.fn(new DatabaseTicketIssuer().issue.bind(new DatabaseTicketIssuer())),
      payments = new PaymentService(
        gateway,
        new BookingPaymentAdapter(),
        { issue },
        'http://127.0.0.1:5173',
        new PaymentRepository(),
        new MerchandisePaymentAdapter(),
      );
    let owner: RequestActor,
      admin: RequestActor,
      buyer: RequestActor,
      other: RequestActor,
      org: string,
      event: Awaited<ReturnType<typeof v1Event>>;
    const recipient = {
      name: 'Fixture Recipient',
      phone: '0901234567',
      address: '123 Fixture Street, District 1, Ho Chi Minh City',
      country: 'VN',
    };
    beforeAll(async () => {
      owner = await v1Account('ORGANIZER');
      admin = await v1Account('ADMIN');
      buyer = await v1Account();
      other = await v1Account();
      org = await v1Organization(owner, admin);
      event = await v1Event(owner, admin, org);
    });
    afterAll(() => pool.end());
    async function product(stock = 5, ticket = false) {
      let p = await service.createProduct(
        owner,
        event.id,
        productInput.parse({
          name: 'Shirt',
          description: 'Fixture shirt',
          requiresTicket: ticket,
          shippingFeeMinor: '3000',
          skus: [{ code: 'M', name: 'Medium', priceMinor: '10000', stockTotal: stock }],
        }),
        uid(),
        uid(),
      );
      await expect(
        service.changeProduct(owner, p.id, 'submit', p.version, 'Fixture', undefined, uid(), uid()),
      ).rejects.toMatchObject({ code: 'MERCHANDISE_CONFLICT' });
      const image = {
        purpose: 'merchandise' as const,
        targetId: p.id,
        version: p.version,
        contentType: 'image/png' as const,
        size: 12,
      };
      await withTransaction(async (db) => {
        await mediaRepository.authorize(db, owner, image, true);
        await mediaRepository.save(
          db,
          owner,
          image,
          'https://images.fixture.invalid/shirt.png',
          uid(),
        );
      });
      p = await service.product(owner, p.id);
      p = await service.changeProduct(
        owner,
        p.id,
        'submit',
        p.version,
        'Fixture',
        undefined,
        uid(),
        uid(),
      );
      await expect(
        service.changeProduct(
          owner,
          p.id,
          'approve',
          p.version,
          'Fixture',
          undefined,
          uid(),
          uid(),
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      p = await service.changeProduct(
        admin,
        p.id,
        'approve',
        p.version,
        'Fixture',
        undefined,
        uid(),
        uid(),
      );
      return p;
    }
    const input = (skuId: string, q = 1) =>
      orderInput.parse({ eventId: event.id, items: [{ skuId, quantity: q }], recipient });
    async function payOrder(id: string, user = buyer) {
      const p = await payments.start(user, id, uid(), uid(), true),
        r = (
          await pool.query('SELECT provider_key,provider_reference FROM payments WHERE id=$1', [
            p.id,
          ])
        ).rows[0];
      const receipt = {
        orderCode: r.provider_key,
        amount: p.amountMinor,
        reference: uid(),
        paymentLinkId: r.provider_reference,
        currency: 'VND',
        code: '00',
      };
      await payments.accept(receipt);
      return { payment: p, receipt };
    }
    it('reserves the last SKU once, snapshots totals, encrypts address, releases expired stock and rejects IDOR', async () => {
      const p = await product(1),
        sku = p.skus[0]!.id;
      const orders = await Promise.allSettled([
        service.createOrder(buyer, input(sku), uid(), uid()),
        service.createOrder(other, input(sku), uid(), uid()),
      ]);
      expect(orders.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      const o = orders.find((o) => o.status === 'fulfilled')!;
      if (o.status !== 'fulfilled') throw new Error('No winner');
      const ownerOfOrder = (
        await pool.query(
          'SELECT customer_id::text,recipient_ciphertext FROM merchandise_orders WHERE id=$1',
          [o.value.id],
        )
      ).rows[0];
      expect(ownerOfOrder.recipient_ciphertext.toString('utf8')).not.toContain('Fixture Street');
      expect(o.value.totalMinor).toBe('13000');
      await expect(
        service.order(ownerOfOrder.customer_id === buyer.id ? other : buyer, o.value.id, 'self'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await pool.query(
        "UPDATE merchandise_orders SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [o.value.id],
      );
      expect((await service.publicSkus(p.public_id)).skus[0]!.available).toBe(1);
      const next = await service.createOrder(buyer, input(sku), uid(), uid());
      expect(next.expiresAt).not.toBe(o.value.expiresAt);
      await service.expire();
      expect(
        (await pool.query('SELECT status FROM merchandise_orders WHERE id=$1', [o.value.id]))
          .rows[0].status,
      ).toBe('EXPIRED');
      expect(
        orderInput.safeParse({ ...input(sku), items: [{ skuId: sku, quantity: 21 }] }).success,
      ).toBe(false);
      await service.cancel(buyer, next.id, next.version, uid(), uid());
    });
    it('uses the shared payOS inbox once without issuing tickets and supports full evidence-backed unshipped refund', async () => {
      const p = await product(),
        o = await service.createOrder(buyer, input(p.skus[0]!.id, 2), uid(), uid()),
        issueCount = issue.mock.calls.length;
      const paid = await payOrder(o.id);
      await payments.accept(paid.receipt);
      expect(issue.mock.calls.length).toBe(issueCount);
      let order = await service.order(buyer, o.id, 'self');
      expect(order).toMatchObject({ status: 'CONFIRMED', totalMinor: '23000' });
      expect((await service.product(owner, p.id)).skus[0]!.sold_quantity).toBe(2);
      const f = (await refunds.request(buyer, o.id, 'Changed mind', uid(), uid()))!;
      await expect(
        service.fulfill(
          owner,
          o.id,
          {
            version: order.version,
            status: 'SHIPPED',
            reference: 'TRACK',
            note: 'Handed to carrier',
          },
          uid(),
          uid(),
        ),
      ).rejects.toMatchObject({ code: 'MERCHANDISE_CONFLICT' });
      const approved = (await refunds.change(
        owner,
        f.id,
        'approve',
        { version: f.version, reason: 'Approved' },
        'organizer',
        uid(),
        uid(),
      ))!;
      await new Promise((resolve) => setTimeout(resolve, 5));
      const done = refundResult.parse({
        version: approved.version,
        status: 'SUCCESS',
        reference: uid(),
        evidenceNote: 'Bank transfer fixture evidence',
        transferredAt: await databaseTimestamp(),
      });
      await refunds.change(owner, f.id, 'result', done, 'organizer', uid(), uid());
      order = await service.order(buyer, o.id, 'self');
      expect(order.status).toBe('REFUNDED');
      expect((await service.product(owner, p.id)).skus[0]!.sold_quantity).toBe(0);
      expect((await payments.get(buyer, paid.payment.id)).outcome).toBe('SUCCESS');
      await expect(
        refunds.change(owner, f.id, 'result', done, 'organizer', uid(), uid()),
      ).rejects.toMatchObject({ code: 'MERCHANDISE_REFUND_CONFLICT' });
    });
    it('fences late money from reallocated stock, scopes manual compensation to an exact assigned report', async () => {
      const p = await product(1),
        o = await service.createOrder(buyer, input(p.skus[0]!.id), uid(), uid()),
        payment = await payments.start(buyer, o.id, uid(), uid(), true);
      await pool.query(
        "UPDATE merchandise_orders SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [o.id],
      );
      const next = await service.createOrder(other, input(p.skus[0]!.id), uid(), uid());
      const row = (
        await pool.query('SELECT provider_key,provider_reference FROM payments WHERE id=$1', [
          payment.id,
        ])
      ).rows[0];
      await payments.accept({
        orderCode: row.provider_key,
        amount: payment.amountMinor,
        reference: uid(),
        paymentLinkId: row.provider_reference,
        currency: 'VND',
        code: '00',
      });
      expect(await payments.get(buyer, payment.id)).toMatchObject({
        outcome: 'FAILED',
        reconciliationStatus: 'REQUIRED',
      });
      expect((await service.product(owner, p.id)).skus[0]!.sold_quantity).toBe(0);
      await expect(
        reports.create(
          other,
          { eventId: event.id, merchandiseOrderId: o.id, reason: 'Foreign order' },
          uid(),
          uid(),
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      const report = await reports.create(
        buyer,
        { eventId: event.id, merchandiseOrderId: o.id, reason: 'Late payment' },
        uid(),
        uid(),
      );
      await expect(service.order(admin, o.id, 'admin', report.id, uid())).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await reports.claim(admin, report.id, 0, uid(), uid());
      expect(await service.order(admin, o.id, 'admin', report.id, uid())).not.toHaveProperty(
        'recipient',
      );
      const f = (await refunds.compensate(
        admin,
        payment.id,
        report.id,
        'Return late funds',
        uid(),
        uid(),
      ))!;
      await new Promise((resolve) => setTimeout(resolve, 5));
      await refunds.change(
        admin,
        f.id,
        'result',
        refundResult.parse({
          version: f.version,
          status: 'SUCCESS',
          reference: uid(),
          evidenceNote: 'Fixture late money transfer',
          transferredAt: await databaseTimestamp(),
          reportId: report.id,
        }),
        'admin',
        uid(),
        uid(),
      );
      expect((await payments.get(buyer, payment.id)).reconciliationStatus).toBe('RESOLVED');
      await service.cancel(other, next.id, next.version, uid(), uid());
    });
    it('serializes shipping with refund requests and requires report for goods already shipped', async () => {
      const p = await product(),
        o = await service.createOrder(buyer, input(p.skus[0]!.id), uid(), uid());
      await payOrder(o.id);
      const current = await service.order(buyer, o.id, 'self'),
        race = await Promise.allSettled([
          service.fulfill(
            owner,
            o.id,
            {
              version: current.version,
              status: 'SHIPPED',
              reference: 'TRACK',
              note: 'Carrier handover',
            },
            uid(),
            uid(),
          ),
          refunds.request(buyer, o.id, 'Please refund', uid(), uid()),
        ]);
      expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const after = await service.order(buyer, o.id, 'self');
      if (after.fulfillmentStatus === 'SHIPPED') {
        await expect(
          refunds.request(buyer, o.id, 'Refund shipped', uid(), uid()),
        ).rejects.toMatchObject({ code: 'MERCHANDISE_REFUND_CONFLICT' });
        await service.fulfill(
          owner,
          o.id,
          {
            version: after.version,
            status: 'DELIVERED',
            reference: 'TRACK',
            note: 'Recipient confirmed receipt',
          },
          uid(),
          uid(),
        );
      } else expect(await refunds.list(buyer, o.id, 'self')).toHaveLength(1);
    });
    it('checks required ticket at order and confirmation and keeps stock unsold if that ticket is revoked', async () => {
      const p = await product(2, true);
      await expect(
        service.createOrder(other, input(p.skus[0]!.id), uid(), uid()),
      ).rejects.toMatchObject({ code: 'MERCHANDISE_CONFLICT' });
      const seat = (
          await pool.query<{ id: string }>(
            'SELECT id::text FROM session_seats WHERE session_id=$1 ORDER BY id LIMIT 1',
            [event.sessionId],
          )
        ).rows[0]!.id,
        h = await createHold(
          buyer,
          event.publicId,
          event.sessionId,
          [seat],
          uid(),
          uid(),
          async () => {},
        ),
        b = await createBooking(
          buyer,
          {
            holdId: h.data.id,
            attendees: [{ sessionSeatId: seat, attendeeName: 'Fixture Adult' }],
          },
          uid(),
          uid(),
        );
      const item = (
        await pool.query('SELECT id::text FROM booking_items WHERE booking_id=$1', [b.data.id])
      ).rows[0];
      await saveAttendees(
        buyer,
        b.data.id,
        attendeesInput.parse({
          attendees: [
            {
              bookingItemId: item.id,
              phone: '0901234567',
              fullName: 'Fixture Adult',
              dateOfBirth: '1990-01-02',
              cccd: '123456789012',
            },
          ],
        }).attendees,
        uid(),
      );
      const ticketPay = await payments.start(buyer, b.data.id, uid(), uid()),
        row = (
          await pool.query('SELECT provider_key,provider_reference FROM payments WHERE id=$1', [
            ticketPay.id,
          ])
        ).rows[0];
      await payments.accept({
        orderCode: row.provider_key,
        amount: ticketPay.amountMinor,
        reference: uid(),
        paymentLinkId: row.provider_reference,
        currency: 'VND',
        code: '00',
      });
      const o = await service.createOrder(buyer, input(p.skus[0]!.id), uid(), uid()),
        mp = await payments.start(buyer, o.id, uid(), uid(), true);
      await pool.query(
        "UPDATE tickets SET status='CANCELLED' WHERE booking_item_id IN(SELECT id FROM booking_items WHERE booking_id=$1)",
        [b.data.id],
      );
      const m = (
        await pool.query('SELECT provider_key,provider_reference FROM payments WHERE id=$1', [
          mp.id,
        ])
      ).rows[0];
      await payments.accept({
        orderCode: m.provider_key,
        amount: mp.amountMinor,
        reference: uid(),
        paymentLinkId: m.provider_reference,
        currency: 'VND',
        code: '00',
      });
      expect(await payments.get(buyer, mp.id)).toMatchObject({
        outcome: 'FAILED',
        reconciliationStatus: 'REQUIRED',
      });
      expect((await service.product(owner, p.id)).skus[0]!.sold_quantity).toBe(0);
    });
    it.each(['NUMBERED', 'QUANTITY'] as const)(
      'appends approved %s capacity once and preserves held inventory, prices and schedule',
      async (mode) => {
        const e = await v1Event(owner, admin, org, mode);
        const before = (
          await pool.query(
            'SELECT id::text,status,price_minor::text,seat_id::text,section_id::text FROM session_seats WHERE session_id=$1 ORDER BY id',
            [e.sessionId],
          )
        ).rows;
        const held = await createHold(
          buyer,
          e.publicId,
          e.sessionId,
          mode === 'NUMBERED' ? [before[0].id] : [],
          uid(),
          uid(),
          async () => {},
          mode === 'QUANTITY' ? [{ sectionId: before[0].section_id, quantity: 1 }] : undefined,
        );
        const snapshot = (
          await pool.query(
            'SELECT id::text,status,price_minor::text,hold_id::text FROM session_seats WHERE session_id=$1 ORDER BY id',
            [e.sessionId],
          )
        ).rows;
        const payload =
          mode === 'NUMBERED'
            ? {
                seats: [
                  {
                    section: 'Main',
                    row: 'A',
                    number: '2',
                    x: 8,
                    y: 3,
                    width: 1,
                    height: 1,
                    ticketTypeId: e.typeId,
                    priceMinor: '12000',
                  },
                ],
              }
            : { increases: [{ sectionId: before[0].section_id, capacity: 5 }] };
        const change = (await sales.request(
          owner,
          e.id,
          saleChangeInput.parse({
            kind: 'CAPACITY',
            version: e.version,
            sessionId: e.sessionId,
            reason: 'Extra capacity',
            ...payload,
          }),
          uid(),
          uid(),
        ))!;
        expect(
          (
            await pool.query('SELECT count(*)::int n FROM session_seats WHERE session_id=$1', [
              e.sessionId,
            ])
          ).rows[0].n,
        ).toBe(before.length);
        const key = uid();
        await expect(
          sales.decide(owner, change.id, 'approve', change.version, 'Fixture', uid(), uid()),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await sales.decide(admin, change.id, 'approve', change.version, 'Approved', key, uid());
        await sales.decide(admin, change.id, 'approve', change.version, 'Approved', key, uid());
        const after = (
          await pool.query(
            'SELECT id::text,status,price_minor::text,hold_id::text FROM session_seats WHERE session_id=$1 ORDER BY id',
            [e.sessionId],
          )
        ).rows;
        expect(after.slice(0, before.length)).toEqual(snapshot);
        expect(after.length).toBe(mode === 'NUMBERED' ? 2 : 5);
        expect(
          (await pool.query('SELECT count(*)::int n FROM seats WHERE layout_id=$1', [e.layoutId]))
            .rows[0].n,
        ).toBe(mode === 'NUMBERED' ? 2 : 0);
        const version = (await pool.query('SELECT version FROM events WHERE id=$1', [e.id])).rows[0]
          .version;
        const window = (
          await pool.query<{ starts_at: Date; now: Date }>(
            'SELECT starts_at,clock_timestamp() AS now FROM event_sessions WHERE id=$1',
            [e.sessionId],
          )
        ).rows[0]!;
        const wave = (await sales.request(
          owner,
          e.id,
          saleChangeInput.parse({
            kind: 'NEW_SALE_WAVE',
            version,
            sessionId: e.sessionId,
            reason: 'Next window',
            saleOpensAt: new Date(window.now.getTime() - 60000).toISOString(),
            saleClosesAt: window.starts_at.toISOString(),
          }),
          uid(),
          uid(),
        ))!;
        await sales.decide(admin, wave.id, 'approve', wave.version, 'Approved', uid(), uid());
        expect(
          (await pool.query('SELECT status FROM session_seats WHERE id=$1', [snapshot[0].id]))
            .rows[0].status,
        ).toBe('HELD');
        await releaseHold(buyer, held.data.id, uid(), uid());
      },
    );
    it('requires Origin, strict inputs and live customer scope on merchandise HTTP', async () => {
      const app = createApp({ checkDatabase: async () => {}, paymentGateway: gateway }),
        auth =
          'Bearer ' +
          (await accessToken({
            userId: buyer.id,
            sessionId: buyer.sessionId,
            authVersion: 0,
            displayName: 'Fixture',
            identityId: '1',
            expiresAt: new Date(Date.now() + 86400000),
            refreshToken: '',
          }));
      await request(app)
        .post('/api/v1/merchandise-orders')
        .set('Authorization', auth)
        .set('Idempotency-Key', uid())
        .send({})
        .expect(403);
      const p = await product();
      await request(app)
        .post('/api/v1/merchandise-orders')
        .set('Authorization', auth)
        .set('Origin', env.PUBLIC_APP_URL!)
        .set('Idempotency-Key', uid())
        .send({ ...input(p.skus[0]!.id), priceMinor: '1' })
        .expect(400);
      const created = await request(app)
        .post('/api/v1/merchandise-orders')
        .set('Authorization', auth)
        .set('Origin', env.PUBLIC_APP_URL!)
        .set('Idempotency-Key', uid())
        .send(input(p.skus[0]!.id))
        .expect(201);
      expect(created.headers['cache-control']).toContain('no-store');
      await request(app)
        .post('/api/v1/merchandise-orders/' + created.body.data.id + '/payments')
        .set('Authorization', auth)
        .set('Origin', env.PUBLIC_APP_URL!)
        .set('Idempotency-Key', uid())
        .send({})
        .expect(201);
    });
    it.each(['NUMBERED', 'QUANTITY'] as const)(
      'keeps %s capacity independent across sessions sharing one layout',
      async (mode) => {
        const e = await v1Event(owner, admin, org, mode, 2),
          a = e.sessions[0]!,
          b = e.sessions[1]!;
        const zone = (
          await pool.query(
            'SELECT section_id::text FROM session_seats WHERE session_id=$1 LIMIT 1',
            [a.id],
          )
        ).rows[0].section_id;
        for (const target of [a, b]) {
          const version = (await pool.query('SELECT version FROM events WHERE id=$1', [e.id]))
            .rows[0].version;
          const delta =
            mode === 'NUMBERED'
              ? {
                  seats: [
                    {
                      section: 'Main',
                      row: 'A',
                      number: '2',
                      x: 8,
                      y: 3,
                      width: 1,
                      height: 1,
                      ticketTypeId: target.typeId,
                      priceMinor: '12000',
                    },
                  ],
                }
              : { increases: [{ sectionId: zone, capacity: 5 }] };
          const change = (await sales.request(
            owner,
            e.id,
            saleChangeInput.parse({
              kind: 'CAPACITY',
              version,
              sessionId: target.id,
              reason: 'Session expansion',
              ...delta,
            }),
            uid(),
            uid(),
          ))!;
          await sales.decide(admin, change.id, 'approve', change.version, 'Approved', uid(), uid());
          if (target === a)
            expect(
              (
                await pool.query('SELECT count(*)::int n FROM session_seats WHERE session_id=$1', [
                  b.id,
                ])
              ).rows[0].n,
            ).toBe(mode === 'NUMBERED' ? 1 : 3);
        }
        for (const target of [a, b])
          expect(
            (
              await pool.query('SELECT count(*)::int n FROM session_seats WHERE session_id=$1', [
                target.id,
              ])
            ).rows[0].n,
          ).toBe(mode === 'NUMBERED' ? 2 : 5);
        expect(
          (await pool.query('SELECT count(*)::int n FROM seats WHERE layout_id=$1', [e.layoutId]))
            .rows[0].n,
        ).toBe(mode === 'NUMBERED' ? 2 : 0);
      },
    );
    it('rejects stale, overlapping and narrowed active sale proposals; withdrawal does not change inventory', async () => {
      const e = await v1Event(owner, admin, org),
        base = {
          kind: 'CAPACITY',
          version: e.version,
          sessionId: e.sessionId,
          reason: 'Capacity request',
          seats: [
            {
              section: 'Main',
              row: 'A',
              number: '2',
              x: 3,
              y: 3,
              width: 1,
              height: 1,
              ticketTypeId: e.typeId,
              priceMinor: '9000',
            },
          ],
        };
      await expect(
        sales.request(owner, e.id, saleChangeInput.parse(base), uid(), uid()),
      ).rejects.toMatchObject({ code: 'LAYOUT_OVERLAP' });
      await expect(
        sales.request(
          owner,
          e.id,
          saleChangeInput.parse({ ...base, version: e.version - 1 }),
          uid(),
          uid(),
        ),
      ).rejects.toMatchObject({ code: 'SALE_CHANGE_CONFLICT' });
      await expect(
        sales.request(
          owner,
          e.id,
          saleChangeInput.parse({
            kind: 'NEW_SALE_WAVE',
            version: e.version,
            sessionId: e.sessionId,
            reason: 'Future window',
            saleOpensAt: new Date(Date.now() + 86400000).toISOString(),
            saleClosesAt: new Date(Date.now() + 2 * 86400000).toISOString(),
          }),
          uid(),
          uid(),
        ),
      ).rejects.toMatchObject({ code: 'SALE_CHANGE_CONFLICT' });
      const c = (await sales.request(
        owner,
        e.id,
        saleChangeInput.parse({ ...base, seats: base.seats.map((s) => ({ ...s, x: 8 })) }),
        uid(),
        uid(),
      ))!;
      await sales.decide(owner, c.id, 'withdraw', c.version, 'Withdraw request', uid(), uid());
      await expect(
        sales.decide(admin, c.id, 'approve', c.version, 'Late decision', uid(), uid()),
      ).rejects.toMatchObject({ code: 'SALE_CHANGE_CONFLICT' });
      expect(
        (
          await pool.query('SELECT count(*)::int n FROM session_seats WHERE session_id=$1', [
            e.sessionId,
          ])
        ).rows[0].n,
      ).toBe(1);
    });
    it('keeps merchandise money separate from ticket metrics and exposes reconciliation without addresses', async () => {
      const own = await service.overview(owner, org),
        all = await new OperationsService().statistics(admin, statisticsQuery.parse({}));
      expect(own.orders.total).toBeGreaterThan(0);
      expect(all.merchandise.orders.total).toBeGreaterThanOrEqual(own.orders.total!);
      expect(own.money[0]).toHaveProperty('grossSalesMinor');
      expect(all.money[0]).toHaveProperty('grossTicketSalesMinor');
      const orders = await service.orders(owner, org, 1, 100);
      expect(JSON.stringify(orders)).not.toMatch(
        /Fixture Street|recipient_ciphertext|checkout_url/,
      );
      await expect(service.overview(other, org)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    it('accumulates partial merchandise receipts exactly once and keeps recipient out of provider jobs', async () => {
      const p = await product(2),
        o = await service.createOrder(buyer, input(p.skus[0]!.id), uid(), uid()),
        payment = await payments.start(buyer, o.id, uid(), uid(), true);
      const row = (
          await pool.query('SELECT provider_key,provider_reference FROM payments WHERE id=$1', [
            payment.id,
          ])
        ).rows[0],
        receipt = {
          orderCode: row.provider_key,
          amount: '5000',
          reference: uid(),
          paymentLinkId: row.provider_reference,
          currency: 'VND',
          code: '00',
        };
      await payments.accept(receipt);
      await payments.accept(receipt);
      expect((await service.order(buyer, o.id, 'self')).status).toBe('AWAITING_PAYMENT');
      expect((await payments.get(buyer, payment.id)).receivedMinor).toBe('5000');
      await payments.accept({ ...receipt, reference: uid(), amount: '8000' });
      expect((await service.order(buyer, o.id, 'self')).status).toBe('CONFIRMED');
      expect((await service.product(owner, p.id)).skus[0]!.sold_quantity).toBe(1);
      const provider = gateway.requests.get(Number(row.provider_key))!;
      expect(provider.items.reduce((sum, i) => sum + i.quantity * i.price, 0)).toBe(
        provider.amount,
      );
      expect(JSON.stringify(provider)).not.toMatch(/Fixture Recipient|Fixture Street|0901234567/);
    });
    it('fences shipments after event cancellation and refunds shipped exceptions without restocking', async () => {
      const previous = event;
      event = await v1Event(owner, admin, org);
      try {
        const p = await product(3),
          unshipped = await service.createOrder(buyer, input(p.skus[0]!.id), uid(), uid()),
          shipped = await service.createOrder(buyer, input(p.skus[0]!.id), uid(), uid());
        const a = await payOrder(unshipped.id),
          b = await payOrder(shipped.id);
        const state = await service.order(buyer, shipped.id, 'self');
        await service.fulfill(
          owner,
          shipped.id,
          {
            version: state.version,
            status: 'SHIPPED',
            reference: 'CARRIER',
            note: 'Handed over before cancellation',
          },
          uid(),
          uid(),
        );
        await new EventOperationsService().cancel(
          owner,
          event.id,
          { version: event.version, reason: 'Fixture cancellation' },
          uid(),
          uid(),
        );
        await expect(
          service.fulfill(
            owner,
            unshipped.id,
            {
              version: (await service.order(buyer, unshipped.id, 'self')).version,
              status: 'SHIPPED',
              reference: 'CARRIER',
              note: 'Blocked after cancellation',
            },
            uid(),
            uid(),
          ),
        ).rejects.toMatchObject({ code: 'MERCHANDISE_CONFLICT' });
        await expect(
          refunds.request(buyer, unshipped.id, 'Cancelled event', uid(), uid()),
        ).rejects.toMatchObject({ code: 'MERCHANDISE_REFUND_CONFLICT' });
        for (const [o, payment] of [
          [unshipped, a.payment],
          [shipped, b.payment],
        ] as const) {
          const report = await reports.create(
            buyer,
            { eventId: event.id, merchandiseOrderId: o.id, reason: 'Cancelled event merchandise' },
            uid(),
            uid(),
          );
          await reports.claim(admin, report.id, 0, uid(), uid());
          const f = (await refunds.compensate(
            admin,
            payment.id,
            report.id,
            'Approved exception',
            uid(),
            uid(),
          ))!;
          await new Promise((resolve) => setTimeout(resolve, 5));
          await refunds.change(
            admin,
            f.id,
            'result',
            refundResult.parse({
              version: f.version,
              status: 'SUCCESS',
              reference: uid(),
              evidenceNote: 'Fixture cancelled event bank evidence',
              transferredAt: await databaseTimestamp(),
              reportId: report.id,
            }),
            'admin',
            uid(),
            uid(),
          );
        }
        expect((await service.product(owner, p.id)).skus[0]!.sold_quantity).toBe(1);
        expect((await service.order(buyer, shipped.id, 'self')).status).toBe('REFUNDED');
      } finally {
        event = previous;
      }
    });
  },
);
