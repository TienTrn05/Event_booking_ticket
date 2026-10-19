import type { PoolClient } from 'pg';
import { AppError } from '../../../shared/errors/app-error.js';
import type { MediaActor, UploadInput } from '../schemas/media.schema.js';

export const mediaRepository = {
  async authorize(db: PoolClient, actor: MediaActor, input: UploadInput, lock = false) {
    const permission = input.purpose === 'avatar' ? 'profile.update_self' : 'event.update_own';
    const session = await db.query<{ identity_id: string }>(
      `SELECT s.identity_id::text FROM users u JOIN auth_sessions s ON s.user_id=u.id
       JOIN external_identities i ON i.id=s.identity_id AND i.revoked_at IS NULL
       JOIN user_roles ur ON ur.user_id=u.id JOIN role_permissions rp ON rp.role_id=ur.role_id
       JOIN permissions p ON p.id=rp.permission_id AND p.code=$3
       WHERE u.id=$1 AND s.id=$2 AND u.status='ACTIVE' AND s.revoked_at IS NULL
         AND s.expires_at>CURRENT_TIMESTAMP AND u.auth_version=$4
         ${lock ? 'FOR UPDATE OF u FOR SHARE OF s,i,ur,rp' : ''}`,
      [actor.id, actor.sessionId, permission, actor.authVersion],
    );
    if (!session.rows[0]) throw new AppError(403, 'FORBIDDEN', 'Không có quyền cập nhật ảnh.');
    if (input.purpose === 'avatar') return;
    const event =
      input.purpose === 'event'
        ? await db.query<{ id: string; organization_id: string; status: string; version: number }>(
            `SELECT id::text, organization_id::text, status, version FROM events WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
            [input.targetId],
          )
        : await db.query<{ id: string; organization_id: string; status: string; version: number }>(
            `SELECT e.id::text, e.organization_id::text, mp.status, mp.version FROM events e
         JOIN merchandise_products mp ON mp.event_id=e.id AND mp.organization_id=e.organization_id
         WHERE mp.id=$1 ${lock ? 'FOR UPDATE OF e,mp' : ''}`,
            [input.targetId],
          );
    const target = event.rows[0];
    if (!target) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.');
    const membership = await db.query(
      `SELECT m.id FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id
       JOIN external_identities i ON i.id=$3 AND i.user_id=m.user_id
       WHERE m.organization_id=$1 AND m.user_id=$2 AND m.status IN ('PENDING','ACTIVE') AND o.status IN ('PENDING_REVIEW','APPROVED','REJECTED')
         AND i.revoked_at IS NULL
         ${lock ? 'FOR SHARE OF m,o,i' : ''}`,
      [target.organization_id, actor.id, session.rows[0].identity_id],
    );
    if (!membership.rowCount) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.');
    if (target.status !== 'DRAFT' || target.version !== input.version)
      throw new AppError(
        409,
        'EVENT_VERSION_CONFLICT',
        'Sự kiện phải ở bản nháp và đúng phiên bản.',
      );
    if (input.purpose === 'merchandise') {
      const product = await db.query(
        "SELECT id FROM merchandise_products WHERE id=$1 AND status='DRAFT'",
        [input.targetId],
      );
      if (!product.rowCount)
        throw new AppError(409, 'PRODUCT_NOT_DRAFT', 'Sản phẩm phải ở bản nháp.');
    }
  },
  async save(
    db: PoolClient,
    actor: MediaActor,
    input: UploadInput,
    url: string,
    requestId: string,
  ) {
    if (input.purpose === 'avatar') {
      await db.query('UPDATE users SET avatar_url=$2 WHERE id=$1', [actor.id, url]);
    } else if (input.purpose === 'event') {
      await db.query('UPDATE events SET cover_image_url=$2, version=version+1 WHERE id=$1', [
        input.targetId,
        url,
      ]);
    } else {
      await db.query('UPDATE merchandise_products SET image_url=$2,version=version+1 WHERE id=$1', [
        input.targetId,
        url,
      ]);
    }
    await db.query(
      `INSERT INTO audit_logs (actor_type,actor_id,action,resource_type,resource_id,request_id)
      VALUES ('USER',$1,'media.image.update',$2,$3,$4)`,
      [
        actor.id,
        input.purpose === 'avatar' ? 'USER' : input.purpose.toUpperCase(),
        input.purpose === 'avatar' ? actor.id : input.targetId,
        requestId,
      ],
    );
  },
  async avatar(db: PoolClient, userId: string) {
    const { rows } = await db.query<{ avatar_url: string | null }>(
      'SELECT avatar_url FROM users WHERE id=$1',
      [userId],
    );
    return rows[0]?.avatar_url ?? null;
  },
};
