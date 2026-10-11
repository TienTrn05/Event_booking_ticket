import type { PoolClient } from 'pg';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { AppError } from '../../../shared/errors/app-error.js';
export const ageRepository = {
  async eligibilityContext(db: PoolClient, eventId: string, sessionId: string) {
    const { rows } = await db.query<{
      minimum_age: number | null;
      reference_date: string;
      today: string;
    }>(
      `SELECT e.minimum_age,
        to_char((s.starts_at AT TIME ZONE v.timezone)::date,'YYYY-MM-DD') AS reference_date,
        to_char(CURRENT_DATE,'YYYY-MM-DD') AS today FROM events e
        JOIN event_publications ep ON ep.event_id=e.id JOIN organizations o ON o.id=e.organization_id
        JOIN event_sessions s ON s.event_id=e.id JOIN venues v ON v.id=s.venue_id
        WHERE ep.public_id=$1 AND s.id=$2 AND e.status='PUBLISHED' AND o.status='APPROVED'
          AND ep.published_at<=CURRENT_TIMESTAMP AND s.status='SCHEDULED'`,
      [eventId, sessionId],
    );
    return rows[0] ?? null;
  },
  async draft(db: PoolClient, actor: RequestActor, id: string, version: number) {
    const permission = await db.query(
      `SELECT ur.user_id FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id
      JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1 AND p.code='event.update_own' FOR SHARE OF ur,rp`,
      [actor.id],
    );
    if (!permission.rowCount) throw new AppError(403, 'FORBIDDEN', 'Không có quyền sửa sự kiện.');
    const { rows } = await db.query<{ status: string; version: number }>(
      `SELECT e.status,e.version FROM events e
      JOIN organizations o ON o.id=e.organization_id JOIN organization_memberships m ON m.organization_id=o.id
      JOIN auth_sessions s ON s.user_id=m.user_id AND s.identity_id=m.company_identity_id
      JOIN external_identities i ON i.id=s.identity_id
      WHERE e.id=$1 AND m.user_id=$2 AND s.id=$3 AND o.status='APPROVED' AND m.status='ACTIVE'
        AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND i.revoked_at IS NULL
        AND i.email_verified_at IS NOT NULL AND i.provider=m.company_identity_provider
        AND i.provider IN('GOOGLE','COMPANY_EMAIL') AND split_part(i.email_canonical,'@',2)=o.company_domain
        AND (i.provider='COMPANY_EMAIL' OR i.hosted_domain=o.company_domain)
      FOR UPDATE OF e FOR SHARE OF o,m,s,i`,
      [id, actor.id, actor.sessionId],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
    if (rows[0].status !== 'DRAFT' || rows[0].version !== version)
      throw new AppError(
        409,
        'EVENT_VERSION_CONFLICT',
        'Sự kiện phải ở bản nháp và đúng phiên bản.',
      );
  },
  async update(db: PoolClient, id: string, minimumAge: number | null) {
    const { rows } = await db.query(
      `UPDATE events SET minimum_age=$2,version=version+1 WHERE id=$1 RETURNING id::text,minimum_age AS "minimumAge",CASE WHEN minimum_age IS NULL THEN NULL ELSE minimum_age::text||'+' END AS "ageTag",version`,
      [id, minimumAge],
    );
    return rows[0];
  },
  async audit(db: PoolClient, actorId: string, id: string, requestId: string) {
    await db.query(
      `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id)
      VALUES('USER',$1,'event.age.update','EVENT',$2,$3)`,
      [actorId, id, requestId],
    );
  },
};
