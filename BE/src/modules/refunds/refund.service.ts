import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import type { RequestActor } from '../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { claimKey, finishKey } from '../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { requireBuyer, now } from '../bookings/shared/booking.repository.js';
import { BookingRefundAdapter } from '../bookings/refunds/booking-refund.adapter.js';
import { PaymentRefundAdapter } from '../payments/refunds/payment-refund.adapter.js';
import { usersRepository } from '../users/repositories/users.repository.js';
import type { RefundBookingPort, RefundPaymentPort } from './refund.ports.js';
import { RefundRepository, type RefundContext } from './refund.repository.js';
import type { RefundDecision, RefundResult } from './refund.schema.js';
import type { LockedPurchase } from '../payments/application/payment.ports.js';
const missing = () =>
  new AppError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu trong phạm vi của bạn.');
export class RefundService {
  /** Called only with purchase locks and the event cancellation fence already held. */
  async prepareCancellation(
    db: PoolClient,
    purchase: LockedPurchase,
    actorId: string,
    reason: string,
  ) {
    if (purchase.status === 'AWAITING_PAYMENT') {
      await this.payments.closeUnpaid(db, purchase.id);
      return;
    }
    if (purchase.status !== 'CONFIRMED' || !purchase.confirmedPaymentId) return;
    const payment = await this.payments.lock(db, purchase.confirmedPaymentId);
    if (!payment || payment.status !== 'SUCCESS' || payment.amount_minor !== purchase.amount)
      throw new AppError(
        409,
        'CANCELLATION_PAYMENT_CONFLICT',
        'Cần xác nhận giao dịch trước khi lập hoàn tiền.',
      );
    const refundId = await this.repository.cancellation(
      db,
      payment.id,
      actorId,
      purchase.amount,
      reason,
    );
    const tickets = await this.bookings.tickets(db, purchase);
    if (tickets.some((t) => t.status === 'USED'))
      throw new AppError(409, 'REFUND_TICKET_NOT_VALID', 'Vé đã sử dụng không thuộc phạm vi hủy.');
    await this.bookings.revoke(db, purchase.id);
    const c = await this.repository.context(db, purchase.id);
    await this.repository.audit(
      db,
      actorId,
      refundId,
      'refund.event_cancelled',
      randomUUID(),
      'REFUND',
      { organizationId: c!.organization_id },
    );
  }
  constructor(
    private readonly repository = new RefundRepository(),
    private readonly bookings: RefundBookingPort = new BookingRefundAdapter(),
    private readonly payments: RefundPaymentPort = new PaymentRefundAdapter(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  private async admin(db: PoolClient, actor: RequestActor) {
    await this.access.permission(db, actor, 'report.handle');
    if (!(await this.repository.adminRole(db, actor.id)))
      throw new AppError(403, 'FORBIDDEN', 'Cần quyền Admin.');
  }
  private async operator(
    db: PoolClient,
    actor: RequestActor,
    c: RefundContext,
    scope: 'organization' | 'admin',
    reportId?: string,
  ) {
    if (scope === 'organization')
      await this.access.organizer(db, actor, c.organization_id, 'refund.approve');
    else {
      await this.admin(db, actor);
      await this.access.permission(db, actor, 'refund.approve');
      if (!reportId || !(await this.repository.report(db, reportId, actor.id, c))) throw missing();
    }
  }
  async request(
    actor: RequestActor,
    bookingId: string,
    reason: string,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await requireBuyer(db, actor, 'refund.request_self');
      const record = await claimKey(db, actor.id, 'refund.request', key, { bookingId, reason });
      const located = await this.repository.context(db, bookingId);
      if (!located || located.customer_id !== actor.id || !located.payment_id) throw missing();
      if (record.resource_id) {
        const old = await this.repository.get(db, record.resource_id);
        if (!old || old.requested_by !== actor.id) throw missing();
        return old;
      }
      const purchase = await this.bookings.lock(db, bookingId, actor.id),
        c = await this.repository.context(db, bookingId);
      if (!c?.payment_id) throw missing();
      const payment = await this.payments.lock(db, c.payment_id);
      const active = await this.repository.active(db, c.payment_id);
      if (active) throw new AppError(409, 'REFUND_EXISTS', 'Đơn đã có yêu cầu hoàn tiền.');
      const tickets = await this.bookings.tickets(db, purchase);
      if (
        purchase.status !== 'CONFIRMED' ||
        payment?.status !== 'SUCCESS' ||
        payment.reconciliation_status !== 'NONE' ||
        payment.received_minor !== payment.amount_minor ||
        payment.amount_minor !== purchase.amount ||
        payment.currency !== 'VND' ||
        c.event_status !== 'PUBLISHED' ||
        c.session_status !== 'SCHEDULED'
      )
        throw new AppError(
          409,
          'REFUND_NOT_ELIGIBLE',
          'Đơn chưa đủ điều kiện hoàn tiền thông thường; khoản bất thường cần đối soát.',
        );
      if (
        tickets.length !== purchase.items.length ||
        tickets.length === 0 ||
        tickets.some((t) => t.status !== 'VALID')
      )
        throw new AppError(
          409,
          'REFUND_TICKET_NOT_VALID',
          'Chỉ hoàn toàn bộ đơn có mọi vé chưa sử dụng và còn hiệu lực.',
        );
      if ((await now(db)).getTime() > c.starts_at.getTime() - 86400000)
        throw new AppError(
          409,
          'REFUND_DEADLINE_PASSED',
          'Cần yêu cầu trước suất diễn ít nhất 24 giờ.',
        );
      const id = await this.repository.create(db, actor.id, c.payment_id, purchase.amount, reason);
      await finishKey(db, record.id, 'REFUND', id, 201);
      await this.repository.audit(db, actor.id, id, 'refund.request', requestId, 'REFUND', {
        organizationId: c.organization_id,
        version: 0,
        status: 'REQUESTED',
      });
      return this.repository.get(db, id);
    });
  }
  async get(
    actor: RequestActor,
    id: string,
    scope: 'self' | 'organization' | 'admin',
    reportId?: string,
  ) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor);
      const c = await this.repository.context(db, id, true);
      if (!c) throw missing();
      if (scope === 'self') {
        await requireBuyer(db, actor, 'booking.read_self');
        if (c.customer_id !== actor.id) throw missing();
      } else await this.operator(db, actor, c, scope, reportId);
      return this.repository.get(db, id);
    });
  }
  async list(
    actor: RequestActor,
    scope: 'self' | 'organization' | 'admin',
    id: string | undefined,
    page: number,
    size: number,
  ) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor);
      let target = actor.id;
      if (scope === 'self') await requireBuyer(db, actor, 'booking.read_self');
      else if (scope === 'organization') {
        if (!id) throw missing();
        await this.access.organizer(db, actor, id, 'refund.approve');
        target = id;
      } else {
        await this.admin(db, actor);
        if (!id) throw missing();
        const report = await this.repository.report(db, id, actor.id);
        if (!report?.booking_id) throw missing();
        target = report.booking_id;
      }
      return this.repository.list(db, scope, target, page, size);
    });
  }
  async change(
    actor: RequestActor,
    id: string,
    action: 'approve' | 'reject' | 'retry' | 'result',
    input: RefundDecision | RefundResult,
    scope: 'organization' | 'admin',
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      const record = await claimKey(db, actor.id, 'refund.' + action, key, { id, ...input });
      const c = await this.repository.context(db, id, true);
      if (!c || !c.payment_id) throw missing();
      await this.bookings.prepare(db, c.customer_id, c.session_id);
      await this.operator(db, actor, c, scope, input.reportId);
      const purchase = await this.bookings.lock(db, c.booking_id),
        payment = await this.payments.lock(db, c.payment_id),
        row = await this.repository.get(db, id, true);
      if (!row) throw missing();
      if (row.payment_id !== c.payment_id)
        throw new AppError(409, 'REFUND_REQUIRES_RECONCILIATION', 'Khoản này cần đối soát riêng.');
      if (record.resource_id) return row;
      if (row.version !== input.version)
        throw new AppError(409, 'VERSION_CONFLICT', 'Yêu cầu đã thay đổi; tải lại.');
      const tickets = await this.bookings.tickets(db, purchase);
      if (action === 'approve' || action === 'reject') {
        if (row.status !== 'REQUESTED')
          throw new AppError(409, 'REFUND_STATE_CONFLICT', 'Yêu cầu không còn chờ duyệt.');
        if (action === 'approve') {
          if (
            purchase.status !== 'CONFIRMED' ||
            payment?.status !== 'SUCCESS' ||
            payment.amount_minor !== row.amount_minor ||
            payment.received_minor !== row.amount_minor ||
            payment.reconciliation_status !== 'NONE' ||
            tickets.length !== purchase.items.length ||
            tickets.length === 0 ||
            tickets.some((t) => t.status !== 'VALID')
          )
            throw new AppError(
              409,
              'REFUND_TICKET_NOT_VALID',
              'Đơn/tiền/vé không còn đủ điều kiện hoàn toàn bộ.',
            );
          await this.bookings.revoke(db, purchase.id);
        }
        await this.repository.decide(
          db,
          id,
          actor.id,
          action === 'approve',
          (input as RefundDecision).reason,
          scope === 'admin' ? input.reportId : undefined,
        );
      } else if (action === 'retry') {
        if (row.status !== 'FAILED')
          throw new AppError(409, 'REFUND_STATE_CONFLICT', 'Chỉ thử lại yêu cầu hoàn thất bại.');
        await this.repository.retry(db, id, (input as RefundDecision).reason);
      } else {
        if (row.status !== 'PROCESSING')
          throw new AppError(409, 'REFUND_STATE_CONFLICT', 'Yêu cầu không ở trạng thái đang hoàn.');
        const result = input as RefundResult;
        if (result.status === 'SUCCESS') {
          const time = await now(db),
            transferred = new Date(result.transferredAt);
          if (!row.approved_at || transferred < row.approved_at || transferred > time)
            throw new AppError(
              422,
              'INVALID_TRANSFER_TIME',
              'Thời điểm chuyển tiền phải sau khi duyệt và không ở tương lai.',
            );
          if (
            purchase.status !== 'CONFIRMED' ||
            payment?.status !== 'SUCCESS' ||
            payment.received_minor !== row.amount_minor ||
            payment.reconciliation_status !== 'NONE' ||
            tickets.length !== purchase.items.length ||
            tickets.some((t) => t.status !== 'CANCELLED')
          )
            throw new AppError(
              409,
              'REFUND_STATE_CONFLICT',
              'Cần đối soát đơn/tiền/vé trước khi ghi nhận hoàn tất.',
            );
          const duplicate = await this.repository.referenceExists(db, result.reference, id);
          if (duplicate)
            throw new AppError(
              409,
              'REFUND_REFERENCE_EXISTS',
              'Chứng từ đã dùng cho khoản hoàn khác.',
            );
          await this.payments.complete(db, c.payment_id);
          await this.bookings.complete(db, c.booking_id);
        }
        await this.repository.result(db, id, actor.id, result);
      }
      const updated = await this.repository.get(db, id);
      if (!updated) throw missing();
      await this.repository.audit(db, actor.id, id, 'refund.' + action, requestId, 'REFUND', {
        organizationId: c.organization_id,
        ...(scope === 'admin' && input.reportId ? { reportId: input.reportId } : {}),
        version: updated.version,
        status: updated.status,
      });
      await finishKey(db, record.id, 'REFUND', id, 200);
      return this.repository.get(db, id);
    });
  }
  async createReport(
    actor: RequestActor,
    bookingId: string,
    reason: string,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await requireBuyer(db, actor, 'report.create');
      const record = await claimKey(db, actor.id, 'report.create', key, { bookingId, reason });
      const c = await this.repository.context(db, bookingId);
      if (!c || c.customer_id !== actor.id) throw missing();
      if (record.resource_id) return { id: record.resource_id };
      const id = await this.repository.createReport(db, actor.id, c, reason);
      await finishKey(db, record.id, 'SUPPORT_REPORT', id, 201);
      await this.repository.audit(db, actor.id, id, 'report.create', requestId, 'SUPPORT_REPORT');
      return { id };
    });
  }
  async reports(actor: RequestActor, admin: boolean, page: number, size: number) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor);
      if (admin) await this.admin(db, actor);
      return this.repository.reports(db, actor.id, admin, page, size);
    });
  }
  async claimReport(actor: RequestActor, id: string, key: string, requestId: string) {
    return withTransaction(async (db) => {
      await this.admin(db, actor);
      const record = await claimKey(db, actor.id, 'report.claim', key, { id });
      if (record.resource_id) {
        const report = await this.repository.report(db, id, actor.id);
        if (!report) throw missing();
        return report;
      }
      const row = await this.repository.claimReport(db, id, actor.id);
      if (!row) throw missing();
      await finishKey(db, record.id, 'SUPPORT_REPORT', id, 200);
      await this.repository.audit(db, actor.id, id, 'report.claim', requestId, 'SUPPORT_REPORT');
      return row;
    });
  }
  async closeReport(
    actor: RequestActor,
    id: string,
    version: number,
    resolution: string,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await this.admin(db, actor);
      const record = await claimKey(db, actor.id, 'report.close', key, { id, version, resolution });
      if (record.resource_id) return { id, status: 'RESOLVED' };
      const row = await this.repository.closeReport(db, id, actor.id, version, resolution);
      if (!row)
        throw new AppError(
          409,
          'REPORT_STATE_CONFLICT',
          'Report không còn mở, khác người xử lý hoặc version đã thay đổi.',
        );
      await finishKey(db, record.id, 'SUPPORT_REPORT', id, 200);
      await this.repository.audit(db, actor.id, id, 'report.close', requestId, 'SUPPORT_REPORT');
      return row;
    });
  }
}
