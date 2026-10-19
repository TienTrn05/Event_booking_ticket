import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { claimKey, finishKey } from '../../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { EventCancellationAdapter } from '../../bookings/allocation/event-cancellation.adapter.js';
import { RefundService } from '../../refunds/refund.service.js';
import type {
  EventCancellationBookings,
  EventCancellationRefunds,
} from './event-operations.ports.js';
import { EventOperationsRepository } from './event-operations.repository.js';
import type { ContentChange, OperationDecision } from './event-operations.schema.js';
const missing = () =>
  new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên trong phạm vi của bạn.');
export class EventOperationsService {
  async detail(actor: RequestActor, id: string, admin: boolean) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, admin ? 'event.review' : 'event.update_own');
      const request = await this.repository.request(db, id);
      if (!request) throw missing();
      if (!admin) await this.scope(db, actor, request.event_id, 'event.update_own');
      const comparison = await this.repository.comparison(db, id);
      if (!comparison) throw missing();
      return comparison;
    });
  }
  async progress(actor: RequestActor, id: string) {
    return withTransaction(async (db) => {
      const event = await this.scope(db, actor, id, 'event.update_own');
      return { event, jobs: await this.repository.progress(db, id) };
    });
  }
  constructor(
    private readonly repository = new EventOperationsRepository(),
    private readonly access = new ManagementAccessRepository(),
    private readonly bookings: EventCancellationBookings = new EventCancellationAdapter(),
    private readonly refunds: EventCancellationRefunds = new RefundService(),
  ) {}
  private async scope(db: PoolClient, actor: RequestActor, id: string, permission: string) {
    const event = await this.repository.event(db, id);
    if (!event) throw missing();
    await this.access.organizer(db, actor, event.organization_id, permission);
    return event;
  }
  async request(
    actor: RequestActor,
    id: string,
    input: ContentChange,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await this.scope(db, actor, id, 'event.update_own');
      const claim = await claimKey(db, actor.id, 'event.content.request', key, { id, input });
      if (claim.resource_id) return this.repository.request(db, claim.resource_id);
      const event = (await this.repository.event(db, id, true))!;
      if (event.status !== 'PUBLISHED' || event.version !== input.version)
        throw new AppError(409, 'EVENT_VERSION_CONFLICT', 'Cần sự kiện đã công bố đúng version.');
      if (await this.repository.pending(db, id))
        throw new AppError(409, 'CONTENT_REQUEST_EXISTS', 'Đã có yêu cầu nội dung chờ duyệt.');
      const changeId = await this.repository.create(db, event, actor.id, input);
      await this.repository.audit(db, event, actor.id, 'event.content.request', requestId);
      await finishKey(db, claim.id, 'EVENT_CHANGE', changeId, 201);
      return this.repository.request(db, changeId);
    });
  }
  async list(
    actor: RequestActor,
    id: string | undefined,
    q: { status?: string | undefined; page: number; pageSize: number },
  ) {
    return withTransaction(async (db) => {
      let orgId: string | null = null;
      if (id) orgId = (await this.scope(db, actor, id, 'event.update_own')).organization_id;
      else await this.access.permission(db, actor, 'event.review');
      return this.repository.list(db, orgId, id ?? null, q.status ?? null, q.page, q.pageSize);
    });
  }
  async decide(
    actor: RequestActor,
    id: string,
    action: 'approve' | 'reject' | 'withdraw',
    input: OperationDecision,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      const first = await this.repository.request(db, id);
      if (!first) throw missing();
      if (action === 'withdraw') await this.scope(db, actor, first.event_id, 'event.update_own');
      else await this.access.permission(db, actor, 'event.review');
      const claim = await claimKey(db, actor.id, 'event.content.' + action, key, { id, input });
      const organizationApproved = await this.repository.approvedOrganization(
        db,
        first.organization_id,
      );
      const event = (await this.repository.event(db, first.event_id, true))!;
      const row = (await this.repository.request(db, id, true))!;
      if (claim.resource_id) return row;
      if (row.status !== 'PENDING' || row.version !== input.version)
        throw new AppError(409, 'VERSION_CONFLICT', 'Yêu cầu đã đổi trạng thái hoặc version.');
      if (action === 'approve') {
        if (!organizationApproved)
          throw new AppError(
            409,
            'ORGANIZATION_NOT_APPROVED',
            'Tổ chức chưa được duyệt hoặc đã bị chặn.',
          );
        if (event.status !== 'PUBLISHED' || event.version !== row.event_version)
          throw new AppError(
            409,
            'EVENT_VERSION_CONFLICT',
            'Sự kiện đã thay đổi; không thể áp dụng bản nội dung cũ.',
          );
        await this.repository.apply(db, event.id, row.snapshot_json);
        await this.repository.enqueue(
          db,
          (await this.repository.event(db, event.id))!,
          actor.id,
          'EVENT_UPDATED',
        );
      }
      await this.repository.decide(
        db,
        id,
        actor.id,
        action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'WITHDRAWN',
        input.reason,
      );
      await this.repository.audit(
        db,
        (await this.repository.event(db, event.id))!,
        actor.id,
        'event.content.' + action,
        requestId,
      );
      await finishKey(db, claim.id, 'EVENT_CHANGE', id, 200);
      return this.repository.request(db, id);
    });
  }
  async cancel(
    actor: RequestActor,
    id: string,
    input: OperationDecision,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await this.scope(db, actor, id, 'event.cancel_own');
      const claim = await claimKey(db, actor.id, 'event.cancel', key, { id, input });
      const event = (await this.repository.event(db, id, true))!;
      if (claim.resource_id) return event;
      if (event.status !== 'PUBLISHED' || event.version !== input.version)
        throw new AppError(409, 'EVENT_VERSION_CONFLICT', 'Cần sự kiện đã công bố đúng version.');
      if (!(await this.repository.cancellable(db, id)))
        throw new AppError(
          409,
          'EVENT_CANNOT_CANCEL',
          'Chỉ hủy khi mọi suất chưa bắt đầu và chưa có vé đã sử dụng.',
        );
      await this.repository.cancel(db, id, actor.id, input.reason);
      const updated = (await this.repository.event(db, id))!;
      await this.repository.enqueue(db, updated, actor.id, 'EVENT_CANCELLED', input.reason);
      await this.repository.audit(db, updated, actor.id, 'event.cancel', requestId);
      await finishKey(db, claim.id, 'EVENT', id, 200);
      return updated;
    });
  }
  async recover() {
    let jobId: string | undefined;
    try {
      return await withTransaction(async (db) => {
        const job = await this.repository.job(db);
        if (!job) return false;
        jobId = job.id;
        const next = await this.repository.next(db, job);
        if (!next) {
          await this.repository.advance(db, job);
          return true;
        }
        // FK user locks precede quota/event locks, including the cancellation approver.
        await this.repository.lockUsers(db, [next.customer_id, job.payload_minimal.actorId]);
        if (job.type === 'EVENT_CANCELLED') {
          const purchase = await this.bookings.cancelHold(db, next.id, job.aggregate_id);
          if (purchase)
            await this.refunds.prepareCancellation(
              db,
              purchase,
              job.payload_minimal.actorId,
              job.payload_minimal.reason ?? 'Event cancelled',
            );
        }
        await this.repository.notify(db, job, next.customer_id);
        await this.repository.advance(db, job, next.id);
        const event = (await this.repository.event(db, job.aggregate_id))!;
        await this.repository.audit(db, event, null, 'event.operations.process', randomUUID());
        return true;
      });
    } catch (error) {
      if (jobId) await withTransaction((db) => this.repository.defer(db, jobId!));
      throw error;
    }
  }
}
