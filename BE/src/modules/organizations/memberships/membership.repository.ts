import type { PoolClient } from 'pg';
export type Membership = {
  id: string;
  organizationId: string;
  userId: string;
  status: string;
  version: number;
  invitedBy: string | null;
};
const fields =
  'id::text,organization_id::text AS "organizationId",user_id::text AS "userId",status,version,invited_by::text AS "invitedBy"';
export class MembershipRepository {
  async lockUsers(db: PoolClient, ids: string[]) {
    await db.query('SELECT id FROM users WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [ids]);
  }
  async organization(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<{ applicant_user_id: string; status: string }>(
        `SELECT applicant_user_id::text,status FROM organizations WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async target(db: PoolClient, userId: string) {
    return (
      await db.query<{ id: string; provider: string }>(
        `SELECT i.id::text,i.provider FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id JOIN external_identities i ON i.user_id=u.id WHERE u.id=$1 AND u.status='ACTIVE' AND u.onboarding_completed_at IS NOT NULL AND r.code='ORGANIZER' AND i.revoked_at IS NULL AND i.provider IN ('EMAIL','GOOGLE') ORDER BY i.id LIMIT 1`,
        [userId],
      )
    ).rows[0];
  }
  async get(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<Membership>(
        `SELECT ${fields} FROM organization_memberships WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async pair(db: PoolClient, orgId: string, userId: string) {
    return (
      await db.query<Membership>(
        `SELECT ${fields} FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 FOR UPDATE`,
        [orgId, userId],
      )
    ).rows[0];
  }
  async invite(
    db: PoolClient,
    orgId: string,
    userId: string,
    ownerId: string,
    identity: { id: string; provider: string },
  ) {
    return (
      await db.query<Membership>(
        `INSERT INTO organization_memberships(organization_id,user_id,member_identity_id,member_identity_provider,status,invited_by,invited_at) VALUES($1,$2,$4,$5,'INVITED',$3,clock_timestamp()) ON CONFLICT(organization_id,user_id) DO UPDATE SET status='INVITED',version=organization_memberships.version+1,member_identity_id=$4,member_identity_provider=$5,approved_by=NULL,approved_at=NULL,invited_by=$3,invited_at=clock_timestamp(),responded_at=NULL RETURNING ${fields}`,
        [orgId, userId, ownerId, identity.id, identity.provider],
      )
    ).rows[0]!;
  }
  async invitations(db: PoolClient, userId: string, page: number, size: number) {
    return (
      await db.query<{ items: unknown[]; total: number }>(
        `WITH matches AS (SELECT m.id::text,m.organization_id::text AS "organizationId",o.name AS "organizationName",m.status,m.version,m.invited_at AS "invitedAt" FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=$1 AND m.status='INVITED' AND o.status='APPROVED'),page_rows AS(SELECT * FROM matches ORDER BY id::bigint DESC LIMIT $2 OFFSET $3) SELECT (SELECT count(*)::int FROM matches) AS total,COALESCE((SELECT jsonb_agg(p ORDER BY p.id::bigint DESC) FROM page_rows p),'[]'::jsonb) AS items`,
        [userId, size, (page - 1) * size],
      )
    ).rows[0]!;
  }
  async list(db: PoolClient, orgId: string, page: number, size: number) {
    return (
      await db.query<{ items: unknown[]; total: number }>(
        `WITH matches AS(SELECT m.id::text,m.user_id::text AS "userId",u.display_name AS "displayName",m.status,m.version,o.applicant_user_id=m.user_id AS "isOwner" FROM organization_memberships m JOIN users u ON u.id=m.user_id JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=$1),page_rows AS(SELECT * FROM matches ORDER BY id::bigint LIMIT $2 OFFSET $3) SELECT (SELECT count(*)::int FROM matches) AS total,COALESCE((SELECT jsonb_agg(p ORDER BY p.id::bigint) FROM page_rows p),'[]'::jsonb) AS items`,
        [orgId, size, (page - 1) * size],
      )
    ).rows[0]!;
  }
  async change(
    db: PoolClient,
    id: string,
    status: 'ACTIVE' | 'REVOKED',
    identity?: { identity_id: string; provider: string },
  ) {
    await db.query(
      `UPDATE organization_memberships SET status=$2::varchar,version=version+1,responded_at=clock_timestamp(),approved_by=CASE WHEN $2::varchar='ACTIVE' THEN invited_by ELSE approved_by END,approved_at=CASE WHEN $2::varchar='ACTIVE' THEN clock_timestamp() ELSE approved_at END,member_identity_id=COALESCE($3::bigint,member_identity_id),member_identity_provider=COALESCE($4::varchar,member_identity_provider) WHERE id=$1`,
      [id, status, identity?.identity_id ?? null, identity?.provider ?? null],
    );
  }
  async audit(db: PoolClient, actorId: string, row: Membership, action: string, requestId: string) {
    await db.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id,organization_id,after_redacted) VALUES('USER',$1,$2,'MEMBERSHIP',$3,$4,$5,jsonb_build_object('status',$6::text,'version',$7::int))",
      [actorId, action, row.id, requestId, row.organizationId, row.status, row.version],
    );
  }
}
