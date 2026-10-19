import type { PoolClient } from 'pg';
import type { FeedbackInput } from './feedback.schema.js';
export type FeedbackRow = {
  id: string;
  author_id: string;
  kind: 'SYSTEM' | 'ORGANIZATION';
  organization_id: string | null;
  event_id: string | null;
  stars: number | null;
  content: string;
  category: string;
  status: string;
  version: number;
  reply: string | null;
  replied_at: Date | null;
  moderation_reason: string | null;
  created_at: Date;
  updated_at: Date;
};
export class FeedbackRepository {
  private readonly select =
    'id::text,author_id::text,kind,organization_id::text,event_id::text,stars,content,category,status,version,reply,replied_at,moderation_reason,created_at,updated_at';
  async get(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<FeedbackRow>(
        `SELECT ${this.select} FROM feedback WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async purchase(db: PoolClient, userId: string, eventId: string) {
    return (
      await db.query<{ organization_id: string; eligible: boolean; self_review: boolean }>(
        `SELECT e.organization_id::text,
 EXISTS(SELECT 1 FROM bookings b JOIN event_sessions s ON s.id=b.session_id WHERE b.event_id=e.id AND b.customer_id=$1 AND b.status IN ('CONFIRMED','REFUNDED') AND (s.ends_at<=clock_timestamp() OR e.status='CANCELLED' OR s.status='CANCELLED') AND EXISTS(SELECT 1 FROM booking_items bi JOIN tickets t ON t.booking_item_id=bi.id WHERE bi.booking_id=b.id)) AS eligible,
 EXISTS(SELECT 1 FROM organization_memberships m WHERE m.organization_id=e.organization_id AND m.user_id=$1
   AND (m.status IN ('PENDING','ACTIVE') OR m.approved_at IS NOT NULL
     OR EXISTS(SELECT 1 FROM audit_logs a WHERE a.resource_type='MEMBERSHIP' AND a.resource_id=m.id AND a.action='membership.accept'))
 ) AS self_review FROM events e WHERE e.id=$2 FOR SHARE OF e`,
        [userId, eventId],
      )
    ).rows[0];
  }
  async create(db: PoolClient, userId: string, input: FeedbackInput, orgId: string | null) {
    return (
      await db.query<{ id: string }>(
        `INSERT INTO feedback(author_id,kind,organization_id,event_id,category,stars,content,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(author_id,event_id) DO NOTHING RETURNING id::text`,
        [
          userId,
          input.kind,
          orgId,
          input.kind === 'ORGANIZATION' ? input.eventId : null,
          input.kind === 'ORGANIZATION' ? 'EVENT' : input.category,
          input.stars ?? null,
          input.content,
          input.kind === 'ORGANIZATION' ? 'VISIBLE' : 'OPEN',
        ],
      )
    ).rows[0]?.id;
  }
  async list(
    db: PoolClient,
    scope: 'self' | 'organization' | 'admin',
    id: string | null,
    page: number,
    size: number,
  ) {
    const where =
      scope === 'self'
        ? 'author_id=$1'
        : scope === 'organization'
          ? 'organization_id=$1'
          : '($1::text IS NULL OR kind=$1)';
    const rows = await db.query<FeedbackRow>(
      `SELECT ${this.select} FROM feedback WHERE ${where} ORDER BY id DESC LIMIT $2 OFFSET $3`,
      [id, size, (page - 1) * size],
    );
    const count = (
      await db.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM feedback WHERE ${where}`,
        [id],
      )
    ).rows[0]!.total;
    const summary =
      scope === 'organization'
        ? (
            await db.query<{ count: number; average: string | null }>(
              `SELECT count(*)::int AS count,round(avg(stars),2)::text AS average FROM feedback WHERE organization_id=$1 AND status='VISIBLE'`,
              [id],
            )
          ).rows[0]
        : undefined;
    return { items: rows.rows, total: count, summary };
  }
  async edit(db: PoolClient, id: string, stars: number, content: string, actorId: string) {
    await this.history(db, id, actorId, 'edit');
    await db.query('UPDATE feedback SET stars=$2,content=$3,version=version+1 WHERE id=$1', [
      id,
      stars,
      content,
    ]);
  }
  async reply(db: PoolClient, id: string, reply: string, actorId: string, status?: string) {
    await this.history(db, id, actorId, 'reply');
    await db.query(
      'UPDATE feedback SET reply=$2,replied_by=$3,replied_at=clock_timestamp(),status=COALESCE($4,status),version=version+1 WHERE id=$1',
      [id, reply, actorId, status ?? null],
    );
  }
  async moderate(db: PoolClient, id: string, hidden: boolean, reason: string, actorId: string) {
    await this.history(db, id, actorId, 'moderate');
    await db.query(
      'UPDATE feedback SET status=$2,moderation_reason=$3,version=version+1 WHERE id=$1',
      [id, hidden ? 'HIDDEN' : 'VISIBLE', reason],
    );
  }
  async editable(db: PoolClient, id: string) {
    return (
      await db.query<{ allowed: boolean }>(
        "SELECT clock_timestamp()<created_at+interval '7 days' AS allowed FROM feedback WHERE id=$1",
        [id],
      )
    ).rows[0]!.allowed;
  }
  private async history(db: PoolClient, id: string, actorId: string, action: string) {
    await db.query(
      `UPDATE feedback f SET history=history||jsonb_build_array(jsonb_build_object('version',version,'stars',stars,'content',content,'reply',reply,'status',status,'moderationReason',moderation_reason,'actorId',$2::text,'action',$3::text,'at',clock_timestamp())) WHERE id=$1`,
      [id, actorId, action],
    );
  }
  async audit(db: PoolClient, userId: string, id: string, action: string, requestId: string) {
    await db.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id,organization_id,after_redacted) SELECT 'USER',$1,$2,'FEEDBACK',$3,$4,f.organization_id,jsonb_build_object('kind',f.kind,'version',f.version,'status',f.status) FROM feedback f WHERE f.id=$3",
      [userId, action, id, requestId],
    );
  }
}
