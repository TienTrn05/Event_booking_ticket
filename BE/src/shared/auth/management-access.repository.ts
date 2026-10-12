import type { PoolClient } from 'pg';
import type { RequestActor } from './request-actor.js';
import { usersRepository } from '../../modules/users/repositories/users.repository.js';
import { AppError } from '../errors/app-error.js';
export class ManagementAccessRepository {
  async permission(db: PoolClient, actor: RequestActor, code: string) {
    await usersRepository.profile(db, actor, true);
    if (
      !(
        await db.query(
          `SELECT ur.user_id FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1 AND p.code=$2 FOR SHARE OF ur,rp`,
          [actor.id, code],
        )
      ).rowCount
    )
      throw new AppError(403, 'FORBIDDEN', 'Không có quyền thực hiện thao tác.');
  }
  async identity(db: PoolClient, actor: RequestActor) {
    const row = (
      await db.query<{ identity_id: string; provider: string; domain: string | null }>(
        `SELECT i.id::text AS identity_id,i.provider,CASE WHEN i.email_canonical IS NULL THEN NULL ELSE split_part(i.email_canonical,'@',2) END AS domain FROM auth_sessions s JOIN external_identities i ON i.id=s.identity_id WHERE s.id=$1 AND s.user_id=$2 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND i.revoked_at IS NULL AND i.provider IN ('GOOGLE','EMAIL','COMPANY_EMAIL') FOR SHARE OF s,i`,
        [actor.sessionId, actor.id],
      )
    ).rows[0];
    if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Cần phiên danh tính hợp lệ.');
    return row;
  }
  async organizer(
    db: PoolClient,
    actor: RequestActor,
    organizationId: string,
    permission: string,
    draft = false,
  ) {
    await this.permission(db, actor, permission);
    await usersRepository.requireOnboarding(db, actor.id);
    const row = (
      await db.query<{ id: string }>(
        `SELECT o.id::text FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id WHERE o.id=$1 AND m.user_id=$2 AND (o.status='APPROVED' OR ($3 AND o.status IN ('PENDING_REVIEW','REJECTED'))) AND (m.status='ACTIVE' OR ($3 AND m.status='PENDING')) FOR SHARE OF o,m`,
        [organizationId, actor.id, draft],
      )
    ).rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên trong tổ chức.');
    return this.identity(db, actor);
  }
  async recent(db: PoolClient, actor: RequestActor) {
    if (
      !(
        await db.query(
          `SELECT id FROM auth_sessions WHERE id=$1 AND user_id=$2 AND authenticated_at>clock_timestamp()-interval '5 minutes'`,
          [actor.sessionId, actor.id],
        )
      ).rowCount
    )
      throw new AppError(
        401,
        'REAUTHENTICATION_REQUIRED',
        'Cần đăng nhập lại trước khi duyệt quyền vận hành tổ chức.',
      );
  }
}
