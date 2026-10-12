import { randomUUID } from 'node:crypto';
import { withTransaction } from '../../../shared/database/transaction.js';
import { withConnection } from '../../../shared/database/pool.js';
import { claimKey, finishKey } from '../../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import type {
  BookingPaymentPort,
  PaymentGateway,
  TicketIssuer,
  Receipt,
  PaymentLink,
} from './payment.ports.js';
import { PaymentRepository, type PaymentRow } from '../repositories/payment.repository.js';
export class PaymentService {
  constructor(
    private readonly gateway: PaymentGateway | undefined,
    private readonly bookings: BookingPaymentPort,
    private readonly issuer: TicketIssuer,
    private readonly appOrigin: string | undefined,
    private readonly repository = new PaymentRepository(),
  ) {}
  private configured() {
    if (!this.gateway || !this.appOrigin)
      throw new AppError(503, 'PAYMENT_UNAVAILABLE', 'Thanh toán payOS chưa được cấu hình.');
    return this.gateway;
  }
  private dto(payment: PaymentRow) {
    return {
      id: payment.id,
      bookingId: payment.booking_id,
      provider: 'PAYOS',
      status: payment.status,
      amountMinor: payment.amount_minor,
      receivedMinor: payment.received_minor,
      currency: payment.currency,
      checkoutUrl: payment.checkout_url,
      reconciliationStatus: payment.reconciliation_status,
      reconciliationReason: payment.reconciliation_reason,
    };
  }
  async start(actor: RequestActor, bookingId: string, key: string, requestId: string) {
    this.configured();
    const id = await withTransaction(async (db) => {
      await this.bookings.authorize(db, actor);
      const claim = await claimKey(db, actor.id, 'payment.create', key, {
        method: 'POST',
        route: 'bookings/:bookingId/payments',
        bookingId,
      });
      if (claim.resource_id) {
        const old = await this.repository.find(db, claim.resource_id);
        if (!old) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thanh toán.');
        await this.bookings.lock(db, old.booking_id, actor.id);
        return old.id;
      }
      const purchase = await this.bookings.lock(db, bookingId, actor.id);
      if (!purchase.canConfirm)
        throw new AppError(409, 'BOOKING_NOT_PAYABLE', 'Đơn không còn hiệu lực để thanh toán.');
      if (
        purchase.currency !== 'VND' ||
        BigInt(purchase.amount) <= 0n ||
        BigInt(purchase.amount) > BigInt(Number.MAX_SAFE_INTEGER)
      )
        throw new AppError(
          422,
          'PAYMENT_AMOUNT_INVALID',
          'payOS chỉ nhận số tiền VND trong giới hạn hỗ trợ.',
        );
      if (!(await this.bookings.validateAttendees(db, purchase)))
        throw new AppError(
          422,
          'ATTENDEE_CREDENTIALS_REQUIRED',
          'Cần đủ thông tin và độ tuổi cho từng vé trước thanh toán.',
        );
      const pending = await this.repository.pending(db, bookingId);
      const payment = pending ?? (await this.repository.create(db, bookingId, purchase.amount));
      if (!pending) {
        const returnUrl = new URL('/payments/return', this.appOrigin);
        returnUrl.searchParams.set('bookingId', bookingId);
        const cancelUrl = new URL('/payments/cancel', this.appOrigin);
        cancelUrl.searchParams.set('bookingId', bookingId);
        await this.repository.enqueue(db, payment, {
          orderCode: Number(payment.provider_key),
          amount: Number(purchase.amount),
          description: `VE${payment.id.slice(-7)}`,
          items: purchase.items.map((i) => ({ name: i.name, quantity: 1, price: Number(i.price) })),
          expiredAt: Math.floor(purchase.expiresAt.getTime() / 1000),
          returnUrl: returnUrl.href,
          cancelUrl: cancelUrl.href,
        });
        await this.repository.audit(db, actor.id, 'payment.create', payment.id, requestId);
      }
      await finishKey(db, claim.id, 'PAYMENT', payment.id, 201);
      return payment.id;
    });
    await this.createLink(id);
    return this.get(actor, id);
  }
  async get(actor: RequestActor, id: string) {
    return withTransaction(async (db) => {
      await this.bookings.authorize(db, actor, 'booking.read_self');
      const payment = await this.repository.find(db, id);
      if (!payment) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thanh toán.');
      await this.bookings.lock(db, payment.booking_id, actor.id);
      return this.dto(payment);
    });
  }
  async createLink(paymentId?: string) {
    if (!this.gateway) return false;
    const job = await withTransaction((db) => this.repository.claimLink(db, paymentId));
    if (!job) return false;
    let link: PaymentLink | undefined;
    try {
      if (!job.expired) {
        const request = { ...job.payload_minimal };
        Reflect.deleteProperty(request, 'paymentId');
        try {
          link = await this.gateway.create(request);
        } catch {
          link = await this.gateway.find(request.orderCode);
        }
      } else {
        try {
          link = await this.gateway.find(job.payload_minimal.orderCode);
        } catch {
          await withTransaction((db) => this.repository.finishJob(db, job, true));
          return true;
        }
      }
      if (
        link.orderCode !== job.payload_minimal.orderCode ||
        link.amount !== job.payload_minimal.amount
      )
        throw new Error('Payment target mismatch');
      await withTransaction(async (db) => {
        if (!(await this.repository.lockJob(db, job))) return;
        // Outbox before purchase; no provider call occurs while these locks are held.
        const target = await this.repository.find(db, job.payload_minimal.paymentId);
        if (!target) throw new Error('Payment target missing');
        await this.bookings.lock(db, target.booking_id);
        const current = await this.repository.find(db, job.payload_minimal.paymentId, true);
        if (!current || (current.provider_reference && current.provider_reference !== link!.id))
          throw new Error('Payment link mismatch');
        await this.repository.saveLink(db, current.id, link!.id, link!.checkoutUrl);
        await this.repository.finishJob(db, job, true);
      });
    } catch {
      await withTransaction((db) => this.repository.finishJob(db, job, false));
    }
    return true;
  }
  async webhook(payload: unknown) {
    const receipt = await this.configured().verify(payload);
    return this.accept(receipt);
  }
  async accept(receipt: Receipt) {
    const id = await withTransaction((db) => this.repository.inbox(db, receipt));
    if (id) await this.processInbox(id);
  }
  async processInbox(id: string) {
    return withTransaction(async (db) => {
      const inbox = await this.repository.lockInbox(db, id);
      if (!inbox || inbox.status !== 'RECEIVED' || !inbox.payment_id) return;
      const first = await this.repository.find(db, inbox.payment_id);
      if (!first) return;
      const purchase = await this.bookings.lock(db, first.booking_id);
      const payment = await this.repository.find(db, first.id, true);
      if (!payment) return;
      const receipt = inbox.normalized_payload;
      if (
        BigInt(receipt.amount) <= 0n ||
        receipt.code !== '00' ||
        receipt.currency !== 'VND' ||
        receipt.orderCode !== payment.provider_key ||
        (payment.provider_reference && receipt.paymentLinkId !== payment.provider_reference)
      ) {
        await this.repository.markInbox(db, id, false, 'WEBHOOK_MISMATCH');
        return;
      }
      const total = BigInt(payment.received_minor) + BigInt(receipt.amount),
        expected = BigInt(payment.amount_minor);
      if (total > 9223372036854775807n) {
        await this.repository.markInbox(db, id, false, 'AMOUNT_OVERFLOW');
        return;
      }
      let reason: string | null =
        total < expected ? 'PARTIAL_PAYMENT' : total > expected ? 'OVERPAYMENT' : null;
      const eligible =
        payment.status === 'PENDING' &&
        purchase.canConfirm &&
        (await this.bookings.validateAttendees(db, purchase));
      if (total === expected && !eligible)
        reason =
          payment.status === 'FAILED'
            ? 'PAYMENT_ATTEMPT_CLOSED'
            : purchase.canConfirm
              ? 'ATTENDEE_CREDENTIALS_REQUIRED'
              : 'BOOKING_UNAVAILABLE';
      if (payment.status === 'REFUNDED') reason = 'FUNDS_AFTER_REFUND';
      const status =
        payment.status === 'REFUNDED' ? 'REFUNDED' : total >= expected ? 'SUCCESS' : payment.status;
      await this.repository.recordFunds(
        db,
        payment.id,
        total.toString(),
        status,
        reason,
        receipt.paymentLinkId,
      );
      if (total === expected && eligible) {
        await this.bookings.confirm(db, purchase, payment.id);
        await this.issuer.issue(db, purchase);
      } else if (total >= expected && !purchase.canConfirm)
        await this.bookings.terminate(db, purchase, purchase.expired ? 'EXPIRED' : 'CANCELLED');
      await this.repository.markInbox(db, id, true);
      await this.repository.audit(db, null, 'payment.received', payment.id, randomUUID());
    });
  }
  async recover() {
    if (!this.gateway) return false;
    await this.createLink();
    const inbox = await withConnection((db) => this.repository.pendingInbox(db));
    for (const row of inbox) await this.processInbox(row.id);
    const candidates = await withTransaction((db) => this.repository.candidates(db));
    await Promise.allSettled(
      candidates.map(async (candidate) => {
        const info = await this.gateway!.status(Number(candidate.provider_key));
        const payment = await withConnection((db) => this.repository.find(db, candidate.id));
        if (
          !payment ||
          info.link.orderCode !== Number(payment.provider_key) ||
          String(info.link.amount) !== payment.amount_minor ||
          (payment.provider_reference && info.link.id !== payment.provider_reference)
        )
          return;
        for (const receipt of info.receipts) await this.accept(receipt);
        if (info.status === 'CANCELLED' && info.amountPaid === 0)
          await withTransaction(async (db) => {
            await this.bookings.lock(db, payment.booking_id);
            await this.repository.find(db, payment.id, true);
            await this.repository.failUnpaid(db, payment.id);
          });
      }),
    );
    return false;
  }
}
