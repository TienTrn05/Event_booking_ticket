import type { PoolClient } from 'pg';
export class ReputationRepository {
  async admin(db: PoolClient, userId: string) {
    return !!(
      await db.query(
        "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.code='ADMIN' FOR SHARE OF ur",
        [userId],
      )
    ).rowCount;
  }
  async organization(db: PoolClient, id: string, lock = false) {
    return (
      await db.query(`SELECT id::text FROM organizations WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`, [
        id,
      ])
    ).rows[0];
  }
  async summary(db: PoolClient, id: string) {
    return (
      await db.query<{
        algorithm: string;
        reviewCount: number;
        sumStars: number;
        adjustment: number;
        score: number | null;
        dataStatus: string;
      }>(
        `WITH reviews AS(SELECT count(*)::int AS n,COALESCE(sum(stars),0)::int AS stars FROM feedback WHERE organization_id=$1 AND kind='ORGANIZATION' AND status='VISIBLE'), adjustments AS(SELECT COALESCE(sum(delta),0)::int AS points FROM organization_reputation_entries WHERE organization_id=$1) SELECT 'REPUTATION_V1' AS algorithm,n AS "reviewCount",stars AS "sumStars",points AS adjustment,CASE WHEN n<5 THEN NULL ELSE round(GREATEST(0,LEAST(100,100*((stars+15)::numeric/(n+5)-1)/4+points)),2)::float8 END AS score,CASE WHEN n<5 THEN 'INSUFFICIENT_DATA' ELSE 'SUFFICIENT_DATA' END AS "dataStatus" FROM reviews,adjustments`,
        [id],
      )
    ).rows[0]!;
  }
  async report(db: PoolClient, orgId: string, reportId: string, userId: string) {
    return !!(
      await db.query(
        `SELECT r.id FROM support_reports r JOIN events e ON e.id=r.event_id WHERE r.id=$1 AND e.organization_id=$2 AND r.assigned_admin_id=$3 AND r.status='RESOLVED' FOR SHARE OF r`,
        [reportId, orgId, userId],
      )
    ).rowCount;
  }
  async entry(db: PoolClient, id: string) {
    return (
      await db.query<{
        id: string;
        organization_id: string;
        source_report_id: string | null;
        reverses_entry_id: string | null;
        delta: number;
      }>(
        'SELECT id::text,organization_id::text,source_report_id::text,reverses_entry_id::text,delta FROM organization_reputation_entries WHERE id=$1',
        [id],
      )
    ).rows[0];
  }
  async exists(db: PoolClient, orgId: string, reportId: string) {
    return !!(
      await db.query(
        'SELECT id FROM organization_reputation_entries WHERE organization_id=$1 AND source_report_id=$2',
        [orgId, reportId],
      )
    ).rowCount;
  }
  async reversed(db: PoolClient, id: string) {
    return !!(
      await db.query('SELECT id FROM organization_reputation_entries WHERE reverses_entry_id=$1', [
        id,
      ])
    ).rowCount;
  }
  async create(
    db: PoolClient,
    orgId: string,
    userId: string,
    delta: number,
    reason: string,
    reportId: string | null,
    reversal: string | null,
  ) {
    return (
      await db.query<{ id: string }>(
        'INSERT INTO organization_reputation_entries(organization_id,created_by,delta,reason,source_report_id,reverses_entry_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text',
        [orgId, userId, delta, reason, reportId, reversal],
      )
    ).rows[0]!.id;
  }
  async history(db: PoolClient, orgId: string, page: number, size: number) {
    return (
      await db.query<{ items: unknown[]; total: number }>(
        `WITH matches AS(SELECT id::text,source_report_id::text AS "sourceReportId",reverses_entry_id::text AS "reversesEntryId",delta,reason,created_at AS "createdAt" FROM organization_reputation_entries WHERE organization_id=$1), page_rows AS(SELECT * FROM matches ORDER BY id::bigint DESC LIMIT $2 OFFSET $3) SELECT (SELECT count(*)::int FROM matches) AS total,COALESCE((SELECT jsonb_agg(p ORDER BY p.id::bigint DESC) FROM page_rows p),'[]'::jsonb) AS items`,
        [orgId, size, (page - 1) * size],
      )
    ).rows[0]!;
  }
  async audit(
    db: PoolClient,
    actorId: string,
    orgId: string,
    id: string,
    requestId: string,
    snapshot: unknown,
  ) {
    await db.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,organization_id,request_id,after_redacted) VALUES('USER',$1,'reputation.adjust','REPUTATION_ENTRY',$2,$3,$4,$5)",
      [actorId, id, orgId, requestId, JSON.stringify(snapshot)],
    );
  }
}
