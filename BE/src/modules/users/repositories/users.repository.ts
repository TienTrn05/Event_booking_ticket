import type { PoolClient } from 'pg';
import type { SqlReader } from '../../../shared/database/sql-reader.js';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { ProfileUpdate, UserProfile } from '../schemas/users.schema.js';

export const usersRepository = {
  async requireOnboarding(db: SqlReader, userId: string) {
    if (
      !(
        await db.query('SELECT id FROM users WHERE id=$1 AND onboarding_completed_at IS NOT NULL', [
          userId,
        ])
      ).rowCount
    )
      throw new AppError(409, 'ONBOARDING_REQUIRED', 'Cần hoàn tất thông tin đăng ký.');
  },
  async hasCustomer(db: PoolClient, userId: string) {
    return !!(
      await db.query(
        `SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.code='CUSTOMER'`,
        [userId],
      )
    ).rowCount;
  },
  async profile(db: SqlReader, actor: RequestActor, lock = false): Promise<UserProfile> {
    if (lock) {
      await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [actor.id]);
      await db.query(
        'SELECT s.id FROM auth_sessions s JOIN external_identities i ON i.id=s.identity_id WHERE s.id=$1 AND s.user_id=$2 FOR SHARE OF s,i',
        [actor.sessionId, actor.id],
      );
    }
    const { rows } = await db.query<UserProfile>(
      `SELECT u.id::text, u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
         u.gender, to_char(u.date_of_birth,'YYYY-MM-DD') AS "dateOfBirth"
       FROM users u JOIN auth_sessions s ON s.user_id=u.id
       JOIN external_identities i ON i.id=s.identity_id AND i.revoked_at IS NULL
       WHERE u.id=$1 AND s.id=$2 AND u.status='ACTIVE' AND u.auth_version=$3
         AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()`,
      [actor.id, actor.sessionId, actor.authVersion],
    );
    if (!rows[0]) throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ.');
    return rows[0];
  },
  async requireUpdatePermission(db: PoolClient, userId: string) {
    const { rowCount } = await db.query(
      `SELECT ur.user_id FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id=ur.role_id
       JOIN permissions p ON p.id=rp.permission_id AND p.code='profile.update_self'
       WHERE ur.user_id=$1 FOR SHARE OF ur,rp`,
      [userId],
    );
    if (!rowCount) throw new AppError(403, 'FORBIDDEN', 'Không có quyền cập nhật hồ sơ.');
  },
  async updateFields(db: PoolClient, userId: string, input: ProfileUpdate): Promise<UserProfile> {
    const { rows } = await db.query<UserProfile>(
      `UPDATE users SET display_name=COALESCE($2,display_name),
       gender=CASE WHEN $3 THEN $4 ELSE gender END,
       date_of_birth=CASE WHEN $5 THEN $6::date ELSE date_of_birth END WHERE id=$1
       RETURNING id::text, display_name AS "displayName", avatar_url AS "avatarUrl", gender,
         to_char(date_of_birth,'YYYY-MM-DD') AS "dateOfBirth"`,
      [
        userId,
        input.displayName,
        input.gender !== undefined,
        input.gender,
        input.dateOfBirth !== undefined,
        input.dateOfBirth,
      ],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
    return rows[0];
  },
  async today(db: PoolClient) {
    const { rows } = await db.query<{ today: string }>(
      "SELECT to_char(CURRENT_DATE,'YYYY-MM-DD') AS today",
    );
    return rows[0]!.today;
  },
  async auditUpdate(db: PoolClient, userId: string, requestId: string) {
    await db.query(
      `INSERT INTO audit_logs (actor_type,actor_id,action,resource_type,resource_id,request_id)
       VALUES ('USER',$1,'profile.update_self','USER',$1,$2)`,
      [userId, requestId],
    );
  },
};
