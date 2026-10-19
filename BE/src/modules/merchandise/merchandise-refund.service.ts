import type { PoolClient } from 'pg';
import type { RequestActor } from '../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { AppError } from '../../shared/errors/app-error.js';
import { claimKey, finishKey } from '../../shared/idempotency/idempotency.repository.js';
import { RefundRepository } from '../refunds/refund.repository.js';
import type { RefundDecision, RefundResult } from '../refunds/refund.schema.js';
import { PaymentRefundRepository } from '../payments/refunds/payment-refund.repository.js';
import { MerchandiseRepository, type Order } from './merchandise.repository.js';
import { MerchandisePaymentAdapter } from './merchandise-payment.adapter.js';
import { MerchandiseService } from './merchandise.service.js';
import { MerchandiseRefundRepository } from './merchandise-refund.repository.js';
const conflict = () =>
  new AppError(
    409,
    'MERCHANDISE_REFUND_CONFLICT',
    'Đơn/tiền/giao hàng hoặc version không đủ điều kiện; ngoại lệ cần report.',
  );
const missing = () => new AppError(404, 'NOT_FOUND', 'Không tìm thấy khoản hoàn trong phạm vi.');
export class MerchandiseRefundService {
  constructor(
    private readonly refunds = new RefundRepository(),
    private readonly orders = new MerchandiseRepository(),
    private readonly payments = new PaymentRefundRepository(),
    private readonly repository = new MerchandiseRefundRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  private async operator(
    db: PoolClient,
    actor: RequestActor,
    o: Order,
    scope: 'organizer' | 'admin',
    reportId?: string,
  ) {
    if (scope === 'organizer')
      await this.access.organizer(db, actor, o.organization_id, 'refund.approve');
    else {
      await this.access.admin(db, actor, 'refund.approve');
      await this.access.permission(db, actor, 'report.handle');
      if (!reportId || !(await this.orders.report(db, reportId, actor.id, o))) throw missing();
    }
  }
  async list(
    actor: RequestActor,
    id: string,
    scope: 'self' | 'organizer' | 'admin',
    reportId?: string,
  ) {
    return withTransaction(async (db) => {
      const o = await this.orders.order(db, id);
      if (!o) throw missing();
      await new MerchandiseService().authorizeOrder(db, actor, o, scope, reportId);
      return this.repository.refunds(db, id);
    });
  }
  async request(actor: RequestActor, id: string, reason: string, key: string, requestId: string) {
    return withTransaction(async (db) => {
      const r = this.orders,
        o = await r.order(db, id);
      if (!o) throw missing();
      await new MerchandiseService().authorizeOrder(db, actor, o, 'self');
      await this.access.permission(db, actor, 'refund.request_self');
      const c = await claimKey(db, actor.id, 'merchandise.refund.request', key, { id, reason });
      await new MerchandisePaymentAdapter(r).lock(db, id, actor.id);
      const current = (await r.order(db, id))!;
      if (c.resource_id) return this.refunds.get(db, c.resource_id);
      const e = await r.event(db, o.event_id),
        p = current.confirmed_payment_id
          ? await this.payments.lock(db, current.confirmed_payment_id)
          : undefined;
      if (
        current.status !== 'CONFIRMED' ||
        current.fulfillment_status !== 'UNFULFILLED' ||
        e?.status !== 'PUBLISHED' ||
        p?.status !== 'SUCCESS' ||
        p.received_minor !== current.total_minor ||
        p.reconciliation_status !== 'NONE' ||
        (await this.refunds.active(db, p.id))
      )
        throw conflict();
      const refundId = await this.refunds.create(db, actor.id, p.id, current.total_minor, reason);
      await r.audit(
        db,
        actor.id,
        refundId,
        'merchandise.refund.request',
        o.organization_id,
        requestId,
        'REFUND',
      );
      await finishKey(db, c.id, 'REFUND', refundId, 201);
      return this.refunds.get(db, refundId);
    });
  }
  async compensate(
    actor: RequestActor,
    paymentId: string,
    reportId: string,
    reason: string,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      const t = await this.repository.target(db, paymentId);
      if (!t) throw missing();
      const first = (await this.orders.order(db, t.order_id))!;
      await this.orders.lockUsers(db, [actor.id, first.customer_id]);
      await this.operator(db, actor, first, 'admin', reportId);
      const claim = await claimKey(db, actor.id, 'merchandise.refund.compensate', key, {
        paymentId,
        reportId,
        reason,
      });
      await new MerchandisePaymentAdapter(this.orders).lock(db, t.order_id);
      const p = await this.payments.lock(db, paymentId);
      if (claim.resource_id) return this.refunds.get(db, claim.resource_id);
      if (
        !p ||
        p.status === 'REFUNDED' ||
        BigInt(p.received_minor) <= 0n ||
        (await this.refunds.active(db, p.id))
      )
        throw conflict();
      await this.orders.cancel(db, t.order_id, 'CANCELLED');
      const id = await this.refunds.cancellation(db, p.id, actor.id, p.received_minor, reason);
      await this.refunds.decide(db, id, actor.id, true, reason, reportId);
      await this.orders.audit(
        db,
        actor.id,
        id,
        'merchandise.refund.compensate',
        first.organization_id,
        requestId,
        'REFUND',
        reportId,
      );
      await finishKey(db, claim.id, 'REFUND', id, 201);
      return this.refunds.get(db, id);
    });
  }
  async change(
    actor: RequestActor,
    id: string,
    action: 'approve' | 'reject' | 'retry' | 'result',
    input: RefundDecision | RefundResult,
    scope: 'organizer' | 'admin',
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      const t = await this.repository.target(db, id, true);
      if (!t) throw missing();
      const first = (await this.orders.order(db, t.order_id))!;
      await this.orders.lockUsers(db, [actor.id, first.customer_id]);
      await this.operator(db, actor, first, scope, input.reportId);
      const c = await claimKey(db, actor.id, 'merchandise.refund.' + action, key, {
        id,
        input,
        scope,
      });
      await new MerchandisePaymentAdapter(this.orders).lock(db, t.order_id);
      const o = (await this.orders.order(db, t.order_id))!,
        p = await this.payments.lock(db, t.payment_id),
        r = await this.refunds.get(db, id, true);
      if (!r || !p) throw missing();
      if (c.resource_id) return r;
      if (r.version !== input.version) throw conflict();
      const e = await this.orders.event(db, o.event_id),
        exception =
          r.type === 'COMPENSATION' ||
          o.fulfillment_status !== 'UNFULFILLED' ||
          e?.status !== 'PUBLISHED';
      if (exception && scope !== 'admin') throw conflict();
      if (action === 'approve' || action === 'reject') {
        if (r.status !== 'REQUESTED') throw conflict();
        if (
          action === 'approve' &&
          (o.status !== 'CONFIRMED' ||
            p.status !== 'SUCCESS' ||
            p.received_minor !== r.amount_minor ||
            p.reconciliation_status !== 'NONE')
        )
          throw conflict();
        await this.refunds.decide(
          db,
          id,
          actor.id,
          action === 'approve',
          (input as RefundDecision).reason,
          scope === 'admin' ? input.reportId : undefined,
        );
      } else if (action === 'retry') {
        if (r.status !== 'FAILED') throw conflict();
        await this.refunds.retry(db, id, (input as RefundDecision).reason);
      } else {
        const result = input as RefundResult;
        if (r.status !== 'PROCESSING') throw conflict();
        if (result.status === 'SUCCESS') {
          const transferred = new Date(result.transferredAt),
            now = await this.orders.now(db);
          if (
            !r.approved_at ||
            transferred < r.approved_at ||
            transferred > now ||
            p.status === 'REFUNDED' ||
            p.received_minor !== r.amount_minor ||
            (await this.refunds.referenceExists(db, result.reference, id))
          )
            throw conflict();
          if (
            r.type === 'CUSTOMER' &&
            (o.status !== 'CONFIRMED' || p.reconciliation_status !== 'NONE')
          )
            throw conflict();
          if (r.type === 'COMPENSATION') await this.repository.reconcile(db, p.id);
          else await this.payments.complete(db, p.id);
          if (o.confirmed_payment_id === p.id && o.status === 'CONFIRMED')
            await this.orders.refundComplete(db, o.id, o.fulfillment_status === 'UNFULFILLED');
        }
        await this.refunds.result(db, id, actor.id, result);
      }
      await this.orders.audit(
        db,
        actor.id,
        id,
        'merchandise.refund.' + action,
        o.organization_id,
        requestId,
        'REFUND',
        input.reportId,
      );
      await finishKey(db, c.id, 'REFUND', id, 200);
      return this.refunds.get(db, id);
    });
  }
}
