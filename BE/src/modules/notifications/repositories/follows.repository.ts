import type { PoolClient } from 'pg';
import { AppError } from '../../../shared/errors/app-error.js';
import type { PageInput } from '../../../shared/validation/common.schema.js';
export const followsRepository = {
  async requireCustomer(db: PoolClient, userId: string) {
    const result = await db.query(
      `SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id
      WHERE ur.user_id=$1 AND r.code='CUSTOMER' FOR SHARE OF ur`,
      [userId],
    );
    if (!result.rowCount) throw new AppError(403, 'CUSTOMER_REQUIRED', 'Cần vai trò Customer.');
  },
  async organization(db: PoolClient, publicId: string, approved = true) {
    const { rows } = await db.query<{ id: string }>(
      `SELECT o.id::text FROM organizations o
      JOIN organization_profiles op ON op.organization_id=o.id WHERE op.public_id=$1
      ${approved ? "AND o.status='APPROVED'" : ''} FOR SHARE OF o`,
      [publicId],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy nhà tổ chức.');
    return rows[0].id;
  },
  async get(db: PoolClient, userId: string, organizationId: string) {
    const { rows } = await db.query<{ notificationsEnabled: boolean }>(
      `SELECT notifications_enabled AS "notificationsEnabled"
      FROM organization_follows WHERE user_id=$1 AND organization_id=$2`,
      [userId, organizationId],
    );
    return {
      following: Boolean(rows[0]),
      notificationsEnabled: rows[0]?.notificationsEnabled ?? false,
    };
  },
  async follow(
    db: PoolClient,
    userId: string,
    organizationId: string,
    enabled: boolean | undefined,
  ) {
    await db.query(
      `INSERT INTO organization_follows(user_id,organization_id,notifications_enabled,notifications_enabled_at,created_at)
      VALUES ($1,$2,$3,CASE WHEN $3 THEN clock_timestamp() ELSE NULL END,clock_timestamp())
      ON CONFLICT(user_id,organization_id) DO NOTHING`,
      [userId, organizationId, enabled ?? true],
    );
    if (enabled !== undefined) await this.preference(db, userId, organizationId, enabled);
    return this.get(db, userId, organizationId);
  },
  async preference(db: PoolClient, userId: string, organizationId: string, enabled: boolean) {
    const result = await db.query(
      `UPDATE organization_follows SET notifications_enabled=$3,
      notifications_enabled_at=CASE WHEN NOT $3 THEN NULL WHEN NOT notifications_enabled THEN clock_timestamp()
      ELSE notifications_enabled_at END WHERE user_id=$1 AND organization_id=$2`,
      [userId, organizationId, enabled],
    );
    if (!result.rowCount)
      throw new AppError(404, 'NOT_FOLLOWING', 'Bạn chưa theo dõi nhà tổ chức.');
    return this.get(db, userId, organizationId);
  },
  async unfollow(db: PoolClient, userId: string, organizationId: string) {
    await db.query('DELETE FROM organization_follows WHERE user_id=$1 AND organization_id=$2', [
      userId,
      organizationId,
    ]);
  },
  async list(db: PoolClient, userId: string, page: PageInput) {
    const { rows } = await db.query(
      `SELECT op.public_id AS id,o.name,op.avatar_url AS avatar,
      f.notifications_enabled AS "notificationsEnabled",f.created_at AS "followedAt"
      FROM organization_follows f JOIN organizations o ON o.id=f.organization_id
      JOIN organization_profiles op ON op.organization_id=o.id
      WHERE f.user_id=$1 AND o.status='APPROVED' ORDER BY f.created_at DESC,f.organization_id DESC LIMIT $2 OFFSET $3`,
      [userId, page.pageSize, (page.page - 1) * page.pageSize],
    );
    const count = await db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM organization_follows f
      JOIN organizations o ON o.id=f.organization_id WHERE f.user_id=$1 AND o.status='APPROVED'`,
      [userId],
    );
    return { items: rows, total: count.rows[0]!.total };
  },
};
