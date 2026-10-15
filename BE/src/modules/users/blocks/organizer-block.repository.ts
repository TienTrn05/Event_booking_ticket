import type { PoolClient } from 'pg';
export class OrganizerBlockRepository {
  async change(db: PoolClient, userId: string, organizationId: string, blocked: boolean) {
    if (blocked)
      await db.query(
        'INSERT INTO organization_blocks(user_id,organization_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [userId, organizationId],
      );
    else
      await db.query('DELETE FROM organization_blocks WHERE user_id=$1 AND organization_id=$2', [
        userId,
        organizationId,
      ]);
    return { blocked };
  }
  async list(db: PoolClient, userId: string, page: number, pageSize: number) {
    return (
      await db.query<{ items: Record<string, unknown>[]; total: number }>(
        `WITH matches AS(SELECT o.public_id AS id,o.name,o.avatar_url AS avatar,b.created_at AS "blockedAt",o.id AS sort_id
       FROM organization_blocks b JOIN organizations o ON o.id=b.organization_id WHERE b.user_id=$1),
       page AS(SELECT * FROM matches ORDER BY "blockedAt" DESC,sort_id DESC LIMIT $2 OFFSET $3)
       SELECT (SELECT count(*)::int FROM matches) AS total,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'avatar',avatar,'blockedAt',"blockedAt")
         ORDER BY "blockedAt" DESC,sort_id DESC) FROM page),'[]'::jsonb) AS items`,
        [userId, pageSize, (page - 1) * pageSize],
      )
    ).rows[0]!;
  }
}
