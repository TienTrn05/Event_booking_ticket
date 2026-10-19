import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { ReputationRepository } from '../../reputation/reputation.repository.js';
export type OrganizationRow = {
  id: string;
  name: string;
  contact_domain: string | null;
  applicant_user_id: string;
  applicant_identity_id: string;
  applicant_identity_provider: string;
  status: string;
  version: number;
  review_reason: string | null;
};
export class OrganizationRepository {
  async memberships(db: PoolClient, userId: string, page: number, size: number) {
    return (
      await db.query<{
        items: {
          id: string;
          publicId: string | null;
          name: string;
          membershipId: string;
          isOwner: boolean;
        }[];
        total: number;
      }>(
        `WITH memberships AS (
          SELECT o.id::text,o.public_id AS "publicId",o.name,m.id::text AS "membershipId",
            o.applicant_user_id=$1 AS "isOwner"
          FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
          WHERE m.user_id=$1 AND m.status='ACTIVE' AND o.status='APPROVED'
        ), page_rows AS (SELECT * FROM memberships ORDER BY id::bigint DESC LIMIT $2 OFFSET $3)
        SELECT (SELECT count(*)::int FROM memberships) AS total,
          COALESCE((SELECT jsonb_agg(r ORDER BY r.id::bigint DESC) FROM page_rows r),'[]'::jsonb) AS items`,
        [userId, size, (page - 1) * size],
      )
    ).rows[0]!;
  }
  async own(db: PoolClient, userId: string) {
    return (
      await db.query(
        `SELECT id::text,name,status,version,review_reason AS "reviewReason" FROM organizations WHERE applicant_user_id=$1 ORDER BY id DESC LIMIT 100`,
        [userId],
      )
    ).rows;
  }
  async get(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<OrganizationRow>(
        `SELECT id::text,name,contact_domain,applicant_user_id::text,applicant_identity_id::text,applicant_identity_provider,status,version,review_reason FROM organizations WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async create(
    db: PoolClient,
    userId: string,
    identity: { identity_id: string; provider: string; domain: string | null },
    name: string,
  ) {
    const id = (
      await db.query<{ id: string }>(
        `INSERT INTO organizations(name,contact_domain,applicant_user_id,applicant_identity_id,applicant_identity_provider) VALUES($1,$2,$3,$4,$5) RETURNING id::text`,
        [name, identity.domain, userId, identity.identity_id, identity.provider],
      )
    ).rows[0]!.id;
    await db.query(
      `INSERT INTO organization_memberships(organization_id,user_id,member_identity_id,member_identity_provider,status) VALUES($1,$2,$3,$4,'PENDING')`,
      [id, userId, identity.identity_id, identity.provider],
    );
    return id;
  }
  async pending(db: PoolClient, status: string, page: number, size: number) {
    const rows = await db.query(
      `SELECT id::text,name,status,version,created_at AS "createdAt" FROM organizations WHERE status=$1 ORDER BY created_at,id LIMIT $2 OFFSET $3`,
      [status, size, (page - 1) * size],
    );
    return {
      items: rows.rows,
      total: Number(
        (await db.query('SELECT count(*)::text FROM organizations WHERE status=$1', [status]))
          .rows[0].count,
      ),
    };
  }
  async resubmit(
    db: PoolClient,
    id: string,
    name: string,
    identity: { identity_id: string; provider: string; domain: string | null },
  ) {
    await db.query(
      `UPDATE organizations SET name=$2,status='PENDING_REVIEW',reviewed_by=NULL,reviewed_at=NULL,review_reason=NULL,version=version+1,applicant_identity_id=$3,applicant_identity_provider=$4,contact_domain=$5 WHERE id=$1`,
      [id, name, identity.identity_id, identity.provider, identity.domain],
    );
    await db.query(
      `UPDATE organization_memberships SET member_identity_id=$2,member_identity_provider=$3 WHERE organization_id=$1 AND status='PENDING'`,
      [id, identity.identity_id, identity.provider],
    );
  }
  async decide(
    db: PoolClient,
    row: OrganizationRow,
    actorId: string,
    approve: boolean,
    reason: string,
  ) {
    await db.query(
      `UPDATE organizations SET status=$2,reviewed_by=$3,reviewed_at=clock_timestamp(),review_reason=$4,version=version+1 WHERE id=$1`,
      [row.id, approve ? 'APPROVED' : 'REJECTED', actorId, reason],
    );
    if (approve)
      await db.query(
        `UPDATE organization_memberships SET status='ACTIVE',approved_by=$3,approved_at=clock_timestamp() WHERE organization_id=$1 AND user_id=$2 AND status='PENDING'`,
        [row.id, row.applicant_user_id, actorId],
      );
    if (approve)
      await db.query(
        `UPDATE organizations o SET public_id=$2,avatar_url=COALESCE(u.avatar_url,'/organizer-placeholder.svg'),summary=o.name,category_label='Organizer',profile_created_at=clock_timestamp(),profile_updated_at=clock_timestamp() FROM users u WHERE o.id=$1 AND u.id=o.applicant_user_id AND o.public_id IS NULL`,
        [row.id, 'org-' + randomUUID()],
      );
  }
  async identityValid(db: PoolClient, row: OrganizationRow) {
    return !!(
      await db.query(
        `SELECT i.id FROM external_identities i JOIN users u ON u.id=i.user_id WHERE i.id=$1 AND i.user_id=$2 AND i.revoked_at IS NULL AND u.status='ACTIVE' FOR SHARE OF i,u`,
        [row.applicant_identity_id, row.applicant_user_id],
      )
    ).rowCount;
  }
  async organizerRole(db: PoolClient, userId: string) {
    return !!(
      await db.query(
        `SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.code='ORGANIZER' FOR SHARE OF ur`,
        [userId],
      )
    ).rowCount;
  }
  async audit(db: PoolClient, actorId: string, id: string, action: string, requestId: string) {
    const snapshot =
      action.includes('approve') || action.includes('reject')
        ? await new ReputationRepository().summary(db, id)
        : null;
    await db.query(
      `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id,after_redacted) VALUES('USER',$1,$2,'ORGANIZATION',$3,$4,$5)`,
      [actorId, action, id, requestId, snapshot ? JSON.stringify({ reputation: snapshot }) : null],
    );
  }
}
