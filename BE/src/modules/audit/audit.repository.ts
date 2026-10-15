import type { PoolClient } from 'pg';
import type { AuditQuery } from './audit.schema.js';
export class AuditRepository {
  async list(db: PoolClient, actorId: string, q: AuditQuery) {
    return (
      await db.query<{ items: Record<string, unknown>[]; total: number }>(
        `WITH grants AS(SELECT p.code FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id
       JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1), matches AS(
       SELECT a.id::text,a.actor_type AS "actorType",a.actor_id::text AS "actorId",a.action,
       a.resource_type AS "resourceType",a.resource_id::text AS "resourceId",a.organization_id::text AS "organizationId",
       a.support_report_id::text AS "reportId",a.request_id AS "requestId",a.created_at AS "createdAt"
       FROM audit_logs a WHERE (
        (a.resource_type IN ('EVENT','REVIEW','EVENT_REVIEW','REASON_NOTICE') AND
          EXISTS(SELECT 1 FROM grants WHERE code='event.review')) OR
        (a.resource_type='ORGANIZATION' AND EXISTS(SELECT 1 FROM grants WHERE code='organizer.approve')) OR
        (EXISTS(SELECT 1 FROM grants WHERE code='report.handle') AND EXISTS(SELECT 1 FROM support_reports r
          WHERE r.assigned_admin_id=$1 AND (r.id=a.support_report_id OR (a.resource_type='SUPPORT_REPORT' AND r.id=a.resource_id)))))
       AND ($2::timestamptz IS NULL OR a.created_at>=$2) AND ($3::timestamptz IS NULL OR a.created_at<$3)
       AND ($4::text IS NULL OR a.resource_type=$4) AND ($5::bigint IS NULL OR a.resource_id=$5)
       AND ($6::bigint IS NULL OR a.support_report_id=$6) AND ($7::text IS NULL OR a.action=$7)),
       page AS(SELECT * FROM matches ORDER BY "createdAt" DESC,id::bigint DESC LIMIT $8 OFFSET $9)
       SELECT (SELECT count(*)::int FROM matches) AS total,
       COALESCE((SELECT jsonb_agg(p ORDER BY p."createdAt" DESC,p.id::bigint DESC) FROM page p),'[]'::jsonb) AS items`,
        [
          actorId,
          q.from ?? null,
          q.to ?? null,
          q.resourceType ?? null,
          q.resourceId ?? null,
          q.reportId ?? null,
          q.action ?? null,
          q.pageSize,
          (q.page - 1) * q.pageSize,
        ],
      )
    ).rows[0]!;
  }
}
