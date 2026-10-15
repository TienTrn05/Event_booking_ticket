import type { RequestActor } from '../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { AppError } from '../../shared/errors/app-error.js';
import { claimKey, finishKey } from '../../shared/idempotency/idempotency.repository.js';
import { SupportReportRepository } from './support-report.repository.js';
import { RefundService } from '../refunds/refund.service.js';
import type { ReportInput, ReportQuery } from './support-report.schema.js';
import { usersRepository } from '../users/repositories/users.repository.js';
const missing = () =>
  new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên trong phạm vi report.');
export class SupportReportService {
  private async admin(
    db: Parameters<ManagementAccessRepository['permission']>[0],
    actor: RequestActor,
  ) {
    await this.access.permission(db, actor, 'report.handle');
    if (!(await this.repository.adminRole(db, actor.id)))
      throw new AppError(403, 'FORBIDDEN', 'Cần quyền Admin.');
  }
  async unpublish(
    actor: RequestActor,
    id: string,
    input: { version: number; reportId: string; reason: string },
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.review');
      await this.admin(db, actor);
      await this.access.recent(db, actor);
      const record = await claimKey(db, actor.id, 'event.unpublish', key, { id, input });
      const report = await this.repository.assigned(db, actor.id, input.reportId);
      if (!report || report.event_id !== id) throw missing();
      const locator = await this.repository.event(db, id);
      if (!locator) throw missing();
      await this.repository.organization(db, locator.organization_id);
      const event = await this.repository.event(db, id, true);
      if (record.resource_id) return { id, status: event!.status, version: event!.version };
      if (event?.status !== 'PUBLISHED' || event.version !== input.version)
        throw new AppError(
          409,
          'EVENT_VERSION_CONFLICT',
          'Chỉ gỡ sự kiện đã công bố đúng version.',
        );
      await this.repository.unpublish(db, id);
      await this.repository.audit(
        db,
        actor.id,
        id,
        input.reportId,
        'event.unpublish',
        requestId,
        'EVENT',
        input.reason,
      );
      await finishKey(db, record.id, 'EVENT', id, 200);
      return { id, status: 'ARCHIVED', version: event.version + 1 };
    });
  }
  constructor(
    private readonly repository = new SupportReportRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  async create(actor: RequestActor, input: ReportInput, key: string, requestId: string) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'report.create');
      const record = await claimKey(db, actor.id, 'support_report.create', key, input);
      if (!(await this.repository.ownedResource(db, actor.id, input))) throw missing();
      if (record.resource_id) return { id: record.resource_id };
      const id = await this.repository.create(db, actor.id, input);
      await this.repository.audit(db, actor.id, id, id, 'report.create', requestId);
      await finishKey(db, record.id, 'SUPPORT_REPORT', id, 201);
      return { id };
    });
  }
  async detail(actor: RequestActor, id: string) {
    return withTransaction(async (db) => {
      // The DB role check only controls report access, never access to its booking or credentials.
      await usersRepository.profile(db, actor, true);
      const admin = await this.repository.adminRole(db, actor.id);
      if (admin) await this.admin(db, actor);
      const row = await this.repository.detail(db, actor.id, id, admin);
      if (!row) throw missing();
      return row;
    });
  }
  async list(actor: RequestActor, q: ReportQuery, admin: boolean) {
    return withTransaction(async (db) => {
      if (admin) await this.admin(db, actor);
      else await this.access.permission(db, actor, 'report.create');
      const result = await this.repository.list(db, actor.id, q, admin);
      return {
        ...result,
        pagination: {
          page: q.page,
          pageSize: q.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / q.pageSize),
        },
      };
    });
  }
  async claim(actor: RequestActor, id: string, version: number, key: string, requestId: string) {
    return withTransaction(async (db) => {
      await this.admin(db, actor);
      const record = await claimKey(db, actor.id, 'support_report.claim', key, { id, version });
      if (record.resource_id) {
        const report = await this.repository.assigned(db, actor.id, id);
        if (!report) throw missing();
        return this.repository.detail(db, actor.id, id, true);
      }
      const report = await this.repository.claim(db, actor.id, id, version);
      if (!report)
        throw new AppError(
          409,
          'REPORT_STATE_CONFLICT',
          'Report đã được nhận hoặc version đã thay đổi.',
        );
      await this.repository.audit(db, actor.id, id, id, 'report.claim', requestId);
      await finishKey(db, record.id, 'SUPPORT_REPORT', id, 200);
      return report;
    });
  }
  async booking(actor: RequestActor, id: string, reportId: string, requestId: string) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'booking.read_support');
      await this.admin(db, actor);
      const report = await this.repository.assigned(db, actor.id, reportId);
      if (!report || report.booking_id !== id) throw missing();
      const booking = await this.repository.booking(db, id, report.event_id);
      if (!booking) throw missing();
      await this.repository.audit(
        db,
        actor.id,
        id,
        reportId,
        'booking.read_support',
        requestId,
        'BOOKING',
      );
      return booking;
    });
  }
  close(
    actor: RequestActor,
    id: string,
    version: number,
    resolution: string,
    key: string,
    requestId: string,
  ) {
    return new RefundService().closeReport(actor, id, version, resolution, key, requestId);
  }
}
