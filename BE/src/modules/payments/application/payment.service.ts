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
  PaymentPurchase,
  LockedPurchase,
  PurchasePaymentPort,
} from './payment.ports.js';
import { PaymentRepository, type PaymentRow } from '../repositories/payment.repository.js';
export class PaymentService {
  constructor(
    private readonly gateway: PaymentGateway | undefined,
    private readonly bookings: BookingPaymentPort,
    private readonly issuer: TicketIssuer,
    private readonly appOrigin: string | undefined,
    private readonly repository = new PaymentRepository(),
    private readonly merchandise?: PurchasePaymentPort,
  ) {}
  private target(payment: PaymentRow) {
    if (payment.merchandise_order_id) {
      if (!this.merchandise) throw new Error('Merchandise payment adapter missing');
      return { port: this.merchandise, id: payment.merchandise_order_id };
    }
    if (!payment.booking_id) throw new Error('Payment purchase missing');
    return { port: this.bookings as PurchasePaymentPort, id: payment.booking_id };
  }
  private configured() {
    if (!this.gateway || !this.appOrigin)
      throw new AppError(503, 'PAYMENT_UNAVAILABLE', 'Thanh toán payOS chưa được cấu hình.');
    return this.gateway;
  }
  private dto(payment: PaymentRow, purchase: PaymentPurchase, canRetry: boolean) {
    const succeeded =
      purchase.confirmedPaymentId === payment.id &&
      ((payment.status === 'SUCCESS' && purchase.status === 'CONFIRMED') ||
        (payment.status === 'REFUNDED' && purchase.status === 'REFUNDED'));
    const failed =
      payment.status === 'FAILED' || payment.status === 'SUCCESS' || !purchase.canConfirm;
    return {
      id: payment.id,
      bookingId: payment.booking_id,
      ...(payment.merchandise_order_id ? { merchandiseOrderId: payment.merchandise_order_id } : {}),
      provider: 'PAYOS',
      status: payment.status,
      amountMinor: payment.amount_minor,
      receivedMinor: payment.received_minor,
      currency: payment.currency,
      checkoutUrl: payment.checkout_url,
      reconciliationStatus: payment.reconciliation_status,
      reconciliationReason: payment.reconciliation_reason,
      outcome: succeeded ? 'SUCCESS' : failed ? 'FAILED' : null,
      canRetry,
      expiresAt: purchase.expiresAt.toISOString(),
    };
  }
  async start(
    actor: RequestActor,
    bookingId: string,
    key: string,
    requestId: string,
    merchandise = false,
  ) {
    const port: PurchasePaymentPort = merchandise ? this.merchandise! : this.bookings;
    if (!port) throw new AppError(503, 'PAYMENT_UNAVAILABLE', 'Merchandise payment unavailable.');
    this.configured();
    const id = await withTransaction(async (db) => {
      await port.authorize(db, actor);
      const claim = await claimKey(
        db,
        actor.id,
        merchandise ? 'merchandise.payment.create' : 'payment.create',
        key,
        {
          method: 'POST',
          route: merchandise ? 'merchandise-orders/:id/payments' : 'bookings/:bookingId/payments',
          bookingId,
        },
      );
      if (claim.resource_id) {
        const old = await this.repository.find(db, claim.resource_id);
        if (!old) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thanh toán.');
        const t = this.target(old);
        await t.port.lock(db, t.id, actor.id);
        return old.id;
      }
      const purchase = await port.lock(db, bookingId, actor.id);
      if (!purchase.canConfirm)
        throw new AppError(
          409,
          merchandise ? 'MERCHANDISE_ORDER_NOT_PAYABLE' : 'BOOKING_NOT_PAYABLE',
          'Đơn không còn hiệu lực để thanh toán.',
        );
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
      if (!(await port.validateAttendees(db, purchase)))
        throw new AppError(
          422,
          merchandise ? 'MERCHANDISE_TICKET_REQUIRED' : 'ATTENDEE_CREDENTIALS_REQUIRED',
          merchandise
            ? 'Sản phẩm yêu cầu vé VALID/USED của người mua trong cùng sự kiện.'
            : 'Cần đủ thông tin và độ tuổi cho từng vé trước thanh toán.',
        );
      const pending = await this.repository.pending(db, bookingId, merchandise);
      if (!pending && (await this.repository.hasReceivedFunds(db, bookingId, merchandise)))
        throw new AppError(
          409,
          'PAYMENT_CONFIRMATION_REQUIRED',
          'Đã ghi nhận tiền cho đơn; cần xác nhận kết quả trước khi thanh toán lại.',
        );
      const payment =
        pending ?? (await this.repository.create(db, bookingId, purchase.amount, merchandise));
      if (!pending) {
        const returnUrl = new URL('/payments/return', this.appOrigin);
        returnUrl.searchParams.set(merchandise ? 'merchandiseOrderId' : 'bookingId', bookingId);
        const cancelUrl = new URL('/payments/cancel', this.appOrigin);
        cancelUrl.searchParams.set(merchandise ? 'merchandiseOrderId' : 'bookingId', bookingId);
        await this.repository.enqueue(db, payment, {
          orderCode: Number(payment.provider_key),
          amount: Number(purchase.amount),
          description: `${merchandise ? 'HH' : 'VE'}${payment.id.slice(-7)}`,
          items: purchase.items.map((i) => ({
            name: i.name,
            quantity: i.quantity ?? 1,
            price: Number(i.price),
          })),
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
      const payment = await this.repository.find(db, id);
      if (!payment) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thanh toán.');
      const target = this.target(payment);
      await target.port.authorize(db, actor, 'booking.read_self');
      const purchase = await target.port.lock(db, target.id, actor.id);
      // Read under the purchase lock so a callback cannot leave a stale payment result.
      const current = await this.repository.find(db, id);
      if (!current) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thanh toán.');
      const canRetry =
        current.status === 'FAILED' &&
        current.received_minor === '0' &&
        purchase.canConfirm &&
        !(await this.repository.hasReceivedFunds(db, purchase.id, !!payment.merchandise_order_id));
      return this.dto(current, purchase, canRetry);
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
        const t = this.target(target);
        await t.port.lock(db, t.id);
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
      const t = this.target(first),
        port = t.port;
      const purchase = await port.lock(db, t.id);
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
        (await port.validateAttendees(db, purchase));
      if (total === expected && !eligible)
        reason =
          payment.status === 'FAILED'
            ? 'PAYMENT_ATTEMPT_CLOSED'
            : purchase.canConfirm
              ? payment.merchandise_order_id
                ? 'MERCHANDISE_TICKET_REQUIRED'
                : 'ATTENDEE_CREDENTIALS_REQUIRED'
              : payment.merchandise_order_id
                ? 'MERCHANDISE_UNAVAILABLE'
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
        await port.confirm(db, purchase, payment.id);
        if (!payment.merchandise_order_id) await this.issuer.issue(db, purchase as LockedPurchase);
      } else if (total >= expected && !purchase.canConfirm)
        await port.terminate(db, purchase, purchase.expired ? 'EXPIRED' : 'CANCELLED');
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
    const results = await Promise.allSettled(
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
            const t = this.target(payment);
            await t.port.lock(db, t.id);
            await this.repository.find(db, payment.id, true);
            await this.repository.failUnpaid(db, payment.id);
          });
      }),
    );
    if (results.some((result) => result.status === 'rejected'))
      throw new Error('Payment recovery polling failed.');
    return false;
  }
}
