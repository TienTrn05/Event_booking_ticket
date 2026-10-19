import type { PoolClient } from 'pg';
import type { RequestActor } from '../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import { usersRepository } from '../users/repositories/users.repository.js';
import { requireBuyer } from '../bookings/shared/booking.repository.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { claimKey, finishKey } from '../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { FeedbackRepository, type FeedbackRow } from './feedback.repository.js';
import type { FeedbackInput } from './feedback.schema.js';
const missing = () => new AppError(404, 'NOT_FOUND', 'Không tìm thấy phản hồi.');
export class FeedbackService {
  constructor(
    private readonly repository = new FeedbackRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  private async visible(
    db: PoolClient,
    actor: RequestActor,
    row: FeedbackRow,
    scope: 'self' | 'organization' | 'admin',
  ) {
    if (scope === 'self') {
      if (row.author_id !== actor.id) throw missing();
    } else if (scope === 'admin') await this.access.permission(db, actor, 'feedback.manage');
    else {
      if (row.kind !== 'ORGANIZATION' || !row.organization_id) throw missing();
      await this.access.organizer(db, actor, row.organization_id, 'feedback.reply_own');
    }
  }
  async create(actor: RequestActor, input: FeedbackInput, key: string, requestId: string) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      const record = await claimKey(db, actor.id, 'feedback.create', key, input);
      if (record.resource_id) {
        const row = await this.repository.get(db, record.resource_id);
        if (!row || row.author_id !== actor.id) throw missing();
        return row;
      }
      let orgId: string | null = null;
      if (input.kind === 'ORGANIZATION') {
        await requireBuyer(db, actor, 'booking.read_self');
        const context = await this.repository.purchase(db, actor.id, input.eventId);
        if (!context?.eligible || context.self_review)
          throw new AppError(
            422,
            'REVIEW_NOT_ELIGIBLE',
            'Cần đơn đã mua cho suất kết thúc hoặc bị hủy; không đánh giá tổ chức mình.',
          );
        orgId = context.organization_id;
      }
      const id = await this.repository.create(db, actor.id, input, orgId);
      if (!id) throw new AppError(409, 'REVIEW_EXISTS', 'Bạn đã đánh giá sự kiện này.');
      await finishKey(db, record.id, 'FEEDBACK', id, 201);
      await this.repository.audit(db, actor.id, id, 'feedback.create', requestId);
      return this.repository.get(db, id);
    });
  }
  async get(actor: RequestActor, id: string, scope: 'self' | 'organization' | 'admin') {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor);
      const row = await this.repository.get(db, id);
      if (!row) throw missing();
      await this.visible(db, actor, row, scope);
      return row;
    });
  }
  async list(
    actor: RequestActor,
    scope: 'self' | 'organization' | 'admin',
    id: string | null,
    page: number,
    size: number,
  ) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor);
      if (scope === 'organization') {
        if (!id) throw missing();
        await this.access.organizer(db, actor, id, 'feedback.reply_own');
      }
      if (scope === 'admin') await this.access.permission(db, actor, 'feedback.manage');
      return this.repository.list(db, scope, scope === 'self' ? actor.id : id, page, size);
    });
  }
  async change(
    actor: RequestActor,
    id: string,
    action: 'edit' | 'reply' | 'handle' | 'moderate',
    input: {
      version: number;
      content?: string;
      stars?: number;
      reply?: string;
      status?: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
      hidden?: boolean;
      reason?: string;
    },
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      const record = await claimKey(db, actor.id, 'feedback.' + action, key, { id, ...input });
      const located = await this.repository.get(db, id);
      if (!located) throw missing();
      await this.visible(
        db,
        actor,
        located,
        action === 'edit' ? 'self' : action === 'reply' ? 'organization' : 'admin',
      );
      const row = await this.repository.get(db, id, true);
      if (!row) throw missing();
      if (record.resource_id) return row;
      if (row.version !== input.version)
        throw new AppError(409, 'VERSION_CONFLICT', 'Phản hồi đã thay đổi; tải lại.');
      if (action === 'edit') {
        if (row.kind !== 'ORGANIZATION' || !(await this.repository.editable(db, id)))
          throw new AppError(
            409,
            'REVIEW_EDIT_CLOSED',
            'Chỉ sửa đánh giá tổ chức trong 7 ngày sau khi gửi.',
          );
        await this.repository.edit(db, id, input.stars!, input.content!, actor.id);
      }
      if (action === 'reply') await this.repository.reply(db, id, input.reply!, actor.id);
      if (action === 'handle') {
        if (row.kind !== 'SYSTEM')
          throw new AppError(422, 'WRONG_FEEDBACK_KIND', 'Đây không phải góp ý hệ thống.');
        await this.repository.reply(db, id, input.reply!, actor.id, input.status);
      }
      if (action === 'moderate') {
        if (row.kind !== 'ORGANIZATION')
          throw new AppError(422, 'WRONG_FEEDBACK_KIND', 'Chỉ kiểm duyệt đánh giá tổ chức.');
        await this.repository.moderate(db, id, input.hidden!, input.reason!, actor.id);
      }
      await this.repository.audit(db, actor.id, id, 'feedback.' + action, requestId);
      await finishKey(db, record.id, 'FEEDBACK', id, 200);
      return this.repository.get(db, id);
    });
  }
}
