import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../../shared/auth/management-access.repository.js';
import { usersRepository } from '../../users/repositories/users.repository.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { claimKey, finishKey } from '../../../shared/idempotency/idempotency.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
export class OrganizationService {
  async own(actor: RequestActor) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor);
      return this.repository.own(db, actor.id);
    });
  }
  constructor(
    private readonly repository = new OrganizationRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  async apply(
    actor: RequestActor,
    input: { name: string },
    key: string,
    requestId: string,
    id?: string,
    version?: number,
  ) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'organization.apply');
      await usersRepository.requireOnboarding(db, actor.id);
      if (!(await this.repository.organizerRole(db, actor.id)))
        throw new AppError(403, 'ORGANIZER_REQUIRED', 'Cần vai trò Organizer đã chọn khi đăng ký.');
      const identity = await this.access.identity(db, actor);
      const record = await claimKey(db, actor.id, 'organization.apply', key, {
        id: id ?? null,
        input,
        version: version ?? null,
      });
      if (record.resource_id) return this.repository.get(db, record.resource_id);
      let target = id;
      if (id) {
        const row = await this.repository.get(db, id, true);
        if (!row || row.applicant_user_id !== actor.id)
          throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
        if (row.status !== 'REJECTED' || row.version !== version)
          throw new AppError(
            409,
            'ORGANIZATION_VERSION_CONFLICT',
            'Chỉ gửi lại hồ sơ bị từ chối đúng version.',
          );
        await this.repository.resubmit(db, id, input.name, identity);
      } else target = await this.repository.create(db, actor.id, identity, input.name);
      await this.repository.audit(db, actor.id, target!, 'organization.apply', requestId);
      await finishKey(db, record.id, 'ORGANIZATION', target!, 201);
      return this.repository.get(db, target!);
    });
  }
  async get(actor: RequestActor, id: string) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor);
      const row = await this.repository.get(db, id);
      if (!row || row.applicant_user_id !== actor.id)
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
      return row;
    });
  }
  async list(actor: RequestActor, status: string, page: number, size: number) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'organizer.approve');
      return this.repository.pending(db, status, page, size);
    });
  }
  async decide(
    actor: RequestActor,
    id: string,
    approve: boolean,
    input: { version: number; reason: string },
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'organizer.approve');
      await this.access.recent(db, actor);
      const record = await claimKey(db, actor.id, 'organization.decide', key, {
        id,
        approve,
        ...input,
      });
      const row = await this.repository.get(db, id, true);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
      if (record.resource_id) return row;
      if (row.status !== 'PENDING_REVIEW' || row.version !== input.version)
        throw new AppError(
          409,
          'ORGANIZATION_VERSION_CONFLICT',
          'Hồ sơ/version không còn chờ duyệt.',
        );
      if (approve && !(await this.repository.identityValid(db, row)))
        throw new AppError(422, 'IDENTITY_INVALID', 'Danh tính người đại diện không còn hợp lệ.');
      await this.repository.decide(db, row, actor.id, approve, input.reason);
      await this.repository.audit(
        db,
        actor.id,
        id,
        approve ? 'organization.approve' : 'organization.reject',
        requestId,
      );
      await finishKey(db, record.id, 'ORGANIZATION', id, 200);
      return this.repository.get(db, id);
    });
  }
}
