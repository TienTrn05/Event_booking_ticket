import type { PoolClient } from 'pg';
import type { ReportInput, ReportQuery } from './support-report.schema.js';
const fields = `r.id::text,r.reporter_id::text AS "reporterId",r.event_id::text AS "eventId",
  r.booking_id::text AS "bookingId",r.merchandise_order_id::text AS "merchandiseOrderId",r.status,r.version,r.reason,r.assigned_admin_id::text AS "assignedAdminId",
  r.resolution,r.created_at AS "createdAt",r.resolved_at AS "resolvedAt"`;
export class SupportReportRepository {
  async adminRole(db: PoolClient, userId: string) {
    return !!(
      await db.query(
        "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.code='ADMIN' FOR SHARE OF ur",
        [userId],
      )
    ).rowCount;
  }
  async event(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<{ id: string; organization_id: string; status: string; version: number }>(
        `SELECT id::text,organization_id::text,status,version FROM events WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async organization(db: PoolClient, id: string) {
    await db.query('SELECT id FROM organizations WHERE id=$1 FOR SHARE', [id]);
  }
  async unpublish(db: PoolClient, id: string) {
    await db.query("UPDATE events SET status='ARCHIVED',version=version+1 WHERE id=$1", [id]);
  }
  async ownedResource(db: PoolClient, actorId: string, input: ReportInput) {
    return (
      await db.query<{ organization_id: string }>(
        `SELECT e.organization_id::text FROM events e WHERE e.id=$1 AND
       (CASE WHEN $4::bigint IS NOT NULL THEN EXISTS(SELECT 1 FROM merchandise_orders mo WHERE mo.id=$4 AND mo.event_id=e.id AND (mo.customer_id=$2 OR EXISTS(SELECT 1 FROM organization_memberships m WHERE m.organization_id=e.organization_id AND m.user_id=$2 AND m.status='ACTIVE'))) WHEN $3::bigint IS NOT NULL THEN EXISTS(SELECT 1 FROM bookings b
         WHERE b.id=$3 AND b.event_id=e.id AND b.customer_id=$2)
        ELSE EXISTS(SELECT 1 FROM organization_memberships m WHERE m.organization_id=e.organization_id
          AND m.user_id=$2 AND m.status='ACTIVE') OR EXISTS(SELECT 1 FROM bookings b
          WHERE b.event_id=e.id AND b.customer_id=$2) END)`,
        [input.eventId, actorId, input.bookingId ?? null, input.merchandiseOrderId ?? null],
      )
    ).rows[0];
  }
  async create(db: PoolClient, actorId: string, input: ReportInput) {
    return (
      await db.query<{ id: string }>(
        'INSERT INTO support_reports(reporter_id,event_id,booking_id,reason,merchandise_order_id) VALUES($1,$2,$3,$4,$5) RETURNING id::text',
        [
          actorId,
          input.eventId,
          input.bookingId ?? null,
          input.reason,
          input.merchandiseOrderId ?? null,
        ],
      )
    ).rows[0]!.id;
  }
  async detail(db: PoolClient, actorId: string, id: string, admin: boolean) {
    return (
      await db.query(
        `SELECT ${fields} FROM support_reports r WHERE r.id=$1 AND
      ($3 OR r.reporter_id=$2 OR (r.booking_id IS NULL AND r.merchandise_order_id IS NULL AND EXISTS(SELECT 1 FROM organization_memberships m
        JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=(SELECT organization_id FROM events WHERE id=r.event_id)
        AND m.user_id=$2 AND m.status='ACTIVE' AND o.status='APPROVED'
        AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles role ON role.id=ur.role_id JOIN role_permissions rp ON rp.role_id=role.id
          JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$2 AND role.code='ORGANIZER' AND p.code='report.handle'))))`,
        [id, actorId, admin],
      )
    ).rows[0];
  }
  async list(db: PoolClient, actorId: string, q: ReportQuery, admin: boolean) {
    return (
      await db.query<{ items: Record<string, unknown>[]; total: number }>(
        `WITH matches AS(SELECT ${fields} FROM support_reports r
       WHERE ($1 OR r.reporter_id=$2) AND ($3::text IS NULL OR r.status=$3)),
       page AS(SELECT * FROM matches ORDER BY "createdAt" DESC,id::bigint DESC LIMIT $4 OFFSET $5)
       SELECT (SELECT count(*)::int FROM matches) AS total,
       COALESCE((SELECT jsonb_agg(p ORDER BY p."createdAt" DESC,p.id::bigint DESC) FROM page p),'[]'::jsonb) AS items`,
        [admin, actorId, q.status ?? null, q.pageSize, (q.page - 1) * q.pageSize],
      )
    ).rows[0]!;
  }
  async claim(db: PoolClient, actorId: string, id: string, version: number) {
    return (
      await db.query<{ id: string; status: string; version: number }>(
        `UPDATE support_reports SET status='IN_REVIEW',assigned_admin_id=$2,version=version+1
       WHERE id=$1 AND status='OPEN' AND version=$3 RETURNING id::text,status,version`,
        [id, actorId, version],
      )
    ).rows[0];
  }
  async assigned(db: PoolClient, actorId: string, id: string) {
    return (
      await db.query<{
        id: string;
        event_id: string;
        booking_id: string | null;
        target_user_id: string | null;
      }>(
        `SELECT id::text,event_id::text,booking_id::text,target_user_id::text FROM support_reports
       WHERE id=$1 AND assigned_admin_id=$2 AND status='IN_REVIEW' FOR SHARE`,
        [id, actorId],
      )
    ).rows[0];
  }
  async booking(db: PoolClient, id: string, eventId: string) {
    return (
      await db.query(
        `SELECT b.id::text,b.event_id::text AS "eventId",b.session_id::text AS "sessionId",
      b.status,b.total_minor::text AS "totalMinor",b.currency,b.created_at AS "createdAt",b.expires_at AS "expiresAt",
      (SELECT count(*)::int FROM booking_items bi WHERE bi.booking_id=b.id) AS "itemCount",
      (SELECT jsonb_agg(jsonb_build_object('id',p.id::text,'status',p.status,'amountMinor',p.amount_minor::text)
        ORDER BY p.id) FROM payments p WHERE p.booking_id=b.id) AS payments
      FROM bookings b WHERE b.id=$1 AND b.event_id=$2`,
        [id, eventId],
      )
    ).rows[0];
  }
  async audit(
    db: PoolClient,
    actorId: string,
    id: string,
    reportId: string,
    action: string,
    requestId: string,
    resourceType = 'SUPPORT_REPORT',
    reason?: string,
  ) {
    await db.query(
      `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,support_report_id,request_id,reason)
      VALUES('USER',$1,$2,$3,$4,$5,$6,$7)`,
      [actorId, action, resourceType, id, reportId, requestId, reason ?? null],
    );
  }
}
