import type { PoolClient } from 'pg';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { claimKey, finishKey } from '../../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { MembershipRepository } from './membership.repository.js';
const missing = () =>
  new AppError(404, 'NOT_FOUND', 'Không tìm thấy thành viên trong phạm vi của bạn.');
export class MembershipService {
  constructor(
    private readonly repository = new MembershipRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  private async owner(db: PoolClient, actor: RequestActor, orgId: string) {
    await this.access.organizer(db, actor, orgId, 'event.update_own');
    const org = await this.repository.organization(db, orgId);
    if (!org || org.status !== 'APPROVED' || org.applicant_user_id !== actor.id) throw missing();
    return org;
  }
  async list(actor: RequestActor, orgId: string, page: number, size: number) {
    return withTransaction(async (db) => {
      await this.owner(db, actor, orgId);
      return this.repository.list(db, orgId, page, size);
    });
  }
  async invitations(actor: RequestActor, page: number, size: number) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.update_own');
      return this.repository.invitations(db, actor.id, page, size);
    });
  }
  async invite(
    actor: RequestActor,
    orgId: string,
    input: { userId: string; version: number },
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await this.repository.lockUsers(db, [actor.id, input.userId]);
      await this.owner(db, actor, orgId);
      await this.repository.organization(db, orgId, true);
      if (input.userId === actor.id)
        throw new AppError(409, 'OWNER_MEMBERSHIP', 'Không thay đổi membership chủ tổ chức.');
      const claim = await claimKey(db, actor.id, 'membership.invite', key, { orgId, input });
      if (claim.resource_id) return this.repository.get(db, claim.resource_id);
      const old = await this.repository.pair(db, orgId, input.userId);
      if ((old?.version ?? 0) !== input.version || (old && old.status !== 'REVOKED'))
        throw new AppError(
          409,
          'MEMBERSHIP_CONFLICT',
          'Thành viên/lời mời đã tồn tại hoặc version thay đổi.',
        );
      const identity = await this.repository.target(db, input.userId);
      if (!identity) throw missing();
      const row = await this.repository.invite(db, orgId, input.userId, actor.id, identity);
      await this.repository.audit(db, actor.id, row, 'membership.invite', requestId);
      await finishKey(db, claim.id, 'MEMBERSHIP', row.id, 201);
      return row;
    });
  }
  async change(
    actor: RequestActor,
    id: string,
    version: number,
    action: 'accept' | 'decline' | 'revoke',
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      const initial = await this.repository.get(db, id);
      if (!initial) throw missing();
      const organization = await this.repository.organization(db, initial.organizationId);
      if (!organization) throw missing();
      await this.repository.lockUsers(db, [
        actor.id,
        initial.userId,
        organization.applicant_user_id,
      ]);
      await this.access.permission(db, actor, 'event.update_own');
      const first = await this.repository.get(db, id);
      if (!first) throw missing();
      if (action === 'revoke') await this.owner(db, actor, first.organizationId);
      else {
        if (first.userId !== actor.id) throw missing();
        const org = await this.repository.organization(db, first.organizationId);
        if (!org || org.status !== 'APPROVED') throw missing();
      }
      await this.repository.organization(db, first.organizationId, true);
      const claim = await claimKey(db, actor.id, 'membership.' + action, key, { id, version });
      const row = (await this.repository.get(db, id, true))!;
      if (claim.resource_id) return row;
      const org = await this.repository.organization(db, row.organizationId);
      if (row.userId === org!.applicant_user_id)
        throw new AppError(409, 'OWNER_MEMBERSHIP', 'Không thu hồi chủ tổ chức.');
      if (
        row.version !== version ||
        (action === 'revoke'
          ? !['ACTIVE', 'INVITED'].includes(row.status)
          : row.status !== 'INVITED')
      )
        throw new AppError(409, 'MEMBERSHIP_CONFLICT', 'Trạng thái/version đã thay đổi.');
      const identity = action === 'accept' ? await this.access.identity(db, actor) : undefined;
      if (action === 'accept' && !(await this.repository.target(db, actor.id))) throw missing();
      await this.repository.change(db, id, action === 'accept' ? 'ACTIVE' : 'REVOKED', identity);
      const updated = (await this.repository.get(db, id))!;
      await this.repository.audit(db, actor.id, updated, 'membership.' + action, requestId);
      await finishKey(db, claim.id, 'MEMBERSHIP', id, 200);
      return updated;
    });
  }
}
