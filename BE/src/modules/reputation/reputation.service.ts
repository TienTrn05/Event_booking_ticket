import type { PoolClient } from 'pg';
import type { RequestActor } from '../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { claimKey, finishKey } from '../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ReputationRepository } from './reputation.repository.js';
export class ReputationService {
  constructor(
    private readonly repository = new ReputationRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  private async admin(db: PoolClient, actor: RequestActor, permission = 'event.review') {
    await this.access.permission(db, actor, permission);
    if (!(await this.repository.admin(db, actor.id)))
      throw new AppError(403, 'FORBIDDEN', 'Cần vai trò Admin.');
  }
  async read(actor: RequestActor, orgId: string, admin: boolean, page: number, size: number) {
    return withTransaction(async (db) => {
      if (admin) await this.admin(db, actor);
      else await this.access.organizer(db, actor, orgId, 'sales.read_own');
      if (!(await this.repository.organization(db, orgId)))
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tổ chức.');
      return {
        summary: await this.repository.summary(db, orgId),
        history: await this.repository.history(db, orgId, page, size),
      };
    });
  }
  async adjust(
    actor: RequestActor,
    orgId: string,
    input: { reportId: string; delta: number; reason: string },
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await this.admin(db, actor, 'feedback.manage');
      await this.access.permission(db, actor, 'report.handle');
      if (!(await this.repository.report(db, orgId, input.reportId, actor.id)))
        throw new AppError(404, 'NOT_FOUND', 'Cần report đã kết luận được giao đúng tổ chức.');
      await this.repository.organization(db, orgId, true);
      const claim = await claimKey(db, actor.id, 'reputation.adjust', key, { orgId, input });
      if (claim.resource_id) return this.repository.entry(db, claim.resource_id);
      if (await this.repository.exists(db, orgId, input.reportId))
        throw new AppError(409, 'REPUTATION_SOURCE_EXISTS', 'Nguồn report đã được tính điểm.');
      const id = await this.repository.create(
        db,
        orgId,
        actor.id,
        input.delta,
        input.reason,
        input.reportId,
        null,
      );
      await this.repository.audit(
        db,
        actor.id,
        orgId,
        id,
        requestId,
        await this.repository.summary(db, orgId),
      );
      await finishKey(db, claim.id, 'REPUTATION_ENTRY', id, 201);
      return this.repository.entry(db, id);
    });
  }
  async reverse(actor: RequestActor, id: string, reason: string, key: string, requestId: string) {
    return withTransaction(async (db) => {
      await this.admin(db, actor, 'feedback.manage');
      await this.access.permission(db, actor, 'report.handle');
      const old = await this.repository.entry(db, id);
      if (
        !old ||
        !old.source_report_id ||
        !(await this.repository.report(db, old.organization_id, old.source_report_id, actor.id))
      )
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy nguồn trong phạm vi report.');
      await this.repository.organization(db, old.organization_id, true);
      const claim = await claimKey(db, actor.id, 'reputation.reverse', key, { id, reason });
      if (claim.resource_id) return this.repository.entry(db, claim.resource_id);
      if (await this.repository.reversed(db, id))
        throw new AppError(409, 'REPUTATION_ALREADY_REVERSED', 'Bút toán đã được đảo.');
      const created = await this.repository.create(
        db,
        old.organization_id,
        actor.id,
        -old.delta,
        reason,
        null,
        id,
      );
      await this.repository.audit(
        db,
        actor.id,
        old.organization_id,
        created,
        requestId,
        await this.repository.summary(db, old.organization_id),
      );
      await finishKey(db, claim.id, 'REPUTATION_ENTRY', created, 201);
      return this.repository.entry(db, created);
    });
  }
}
