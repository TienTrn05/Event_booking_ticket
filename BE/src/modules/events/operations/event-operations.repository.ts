import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
export type OperationalEvent = {
  id: string;
  organization_id: string;
  status: string;
  version: number;
  title: string;
  description: string;
  public_id: string;
  cancelled_by: string | null;
  cancellation_reason: string | null;
};
export type ContentRequest = {
  id: string;
  event_id: string;
  organization_id: string;
  status: string;
  version: number;
  event_version: number;
  snapshot_json: { title: string; description: string };
  reason: string;
  decision_reason: string | null;
};
export type OperationJob = {
  id: string;
  type: 'EVENT_CANCELLED' | 'EVENT_UPDATED';
  aggregate_id: string;
  aggregate_version: number;
  payload_minimal: {
    actorId: string;
    title: string;
    eventId: string;
    reason?: string;
    changedAt: string;
    afterId?: string;
  };
};
export class EventOperationsRepository {
  async comparison(db: PoolClient, id: string) {
    return (
      await db.query<{
        request: ContentRequest;
        currentEvent: {
          id: string;
          title: string;
          description: string;
          status: string;
          version: number;
        };
      }>(
        `SELECT jsonb_build_object('id',r.id::text,'event_id',r.event_id::text,'organization_id',r.organization_id::text,'status',r.status,'version',r.version,'event_version',r.event_version,'snapshot_json',r.snapshot_json,'reason',r.reason,'decision_reason',r.decision_reason) AS request,
    jsonb_build_object('id',e.id::text,'title',e.title,'description',e.description,'status',e.status,'version',e.version) AS "currentEvent"
    FROM event_change_requests r JOIN events e ON e.id=r.event_id WHERE r.id=$1 AND r.request_type='CONTENT'`,
        [id],
      )
    ).rows[0];
  }
  async approvedOrganization(db: PoolClient, id: string) {
    return (
      (
        await db.query<{ status: string }>(
          'SELECT status FROM organizations WHERE id=$1 FOR SHARE',
          [id],
        )
      ).rows[0]?.status === 'APPROVED'
    );
  }
  async event(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<OperationalEvent>(
        `SELECT id::text,organization_id::text,status,version,title,description,public_id,cancelled_by::text,cancellation_reason FROM events WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async request(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<ContentRequest>(
        `SELECT id::text,event_id::text,organization_id::text,status,version,event_version,snapshot_json,reason,decision_reason FROM event_change_requests WHERE id=$1 AND request_type='CONTENT' ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async list(
    db: PoolClient,
    orgId: string | null,
    eventId: string | null,
    status: string | null,
    page: number,
    size: number,
  ) {
    return (
      await db.query(
        `SELECT id::text,event_id::text AS "eventId",status,version,event_version AS "eventVersion",snapshot_json AS content,reason,decision_reason AS "decisionReason",requested_at AS "requestedAt" FROM event_change_requests WHERE request_type='CONTENT' AND ($1::bigint IS NULL OR organization_id=$1) AND ($2::bigint IS NULL OR event_id=$2) AND ($3::text IS NULL OR status=$3) ORDER BY id DESC LIMIT $4 OFFSET $5`,
        [orgId, eventId, status, size, (page - 1) * size],
      )
    ).rows;
  }
  async pending(db: PoolClient, eventId: string) {
    return !!(
      await db.query(
        "SELECT 1 FROM event_change_requests WHERE event_id=$1 AND request_type IN ('CONTENT','CAPACITY','NEW_SALE_WAVE') AND status='PENDING'",
        [eventId],
      )
    ).rowCount;
  }
  async create(
    db: PoolClient,
    event: OperationalEvent,
    actorId: string,
    input: { title: string; description: string; reason: string },
  ) {
    return (
      await db.query<{ id: string }>(
        `INSERT INTO event_change_requests(public_id,event_id,organization_id,requested_by,request_type,reason,impact_summary,requested_at,event_version,snapshot_json) VALUES($1,$2,$3,$4,'CONTENT',$5,'Title and description only; schedule, inventory and prices unchanged',clock_timestamp(),$6,$7) RETURNING id::text`,
        [
          'content-' + randomUUID(),
          event.id,
          event.organization_id,
          actorId,
          input.reason,
          event.version,
          JSON.stringify({ title: input.title, description: input.description }),
        ],
      )
    ).rows[0]!.id;
  }
  async decide(db: PoolClient, id: string, actorId: string, status: string, reason: string) {
    await db.query(
      'UPDATE event_change_requests SET status=$2,decided_by=$3,decided_at=clock_timestamp(),decision_reason=$4,version=version+1 WHERE id=$1',
      [id, status, actorId, reason],
    );
  }
  async apply(db: PoolClient, eventId: string, content: { title: string; description: string }) {
    await db.query(
      'UPDATE events SET title=$2,display_name=$2,description=$3,version=version+1,publication_updated_at=clock_timestamp() WHERE id=$1',
      [eventId, content.title, content.description],
    );
  }
  async cancellable(db: PoolClient, id: string) {
    return (
      await db.query<{ ok: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM event_sessions WHERE event_id=$1) AND NOT EXISTS(SELECT 1 FROM event_sessions WHERE event_id=$1 AND starts_at<=clock_timestamp()) AND NOT EXISTS(SELECT 1 FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id JOIN bookings b ON b.id=bi.booking_id WHERE b.event_id=$1 AND t.status='USED') AS ok`,
        [id],
      )
    ).rows[0]!.ok;
  }
  async cancel(db: PoolClient, id: string, actorId: string, reason: string) {
    await db.query(
      "UPDATE events SET status='CANCELLED',version=version+1,cancelled_by=$2,cancelled_at=clock_timestamp(),cancellation_reason=$3 WHERE id=$1",
      [id, actorId, reason],
    );
    await db.query(
      "UPDATE event_change_requests SET status='WITHDRAWN',decided_at=clock_timestamp(),decision_reason='Event cancelled',version=version+1 WHERE event_id=$1 AND request_type='CONTENT' AND status='PENDING'",
      [id],
    );
  }
  async enqueue(
    db: PoolClient,
    event: OperationalEvent,
    actorId: string,
    type: OperationJob['type'],
    reason?: string,
  ) {
    await db.query(
      `INSERT INTO outbox_messages(type,aggregate_type,aggregate_id,aggregate_version,dedupe_key,payload_minimal,available_at) VALUES($1,'EVENT',$2,$3,$4,jsonb_build_object('actorId',$5::text,'title',$6::text,'eventId',$7::text,'reason',$8::text,'changedAt',clock_timestamp(),'afterId','0'),clock_timestamp())`,
      [
        type,
        event.id,
        event.version,
        type + ':' + event.id + ':' + event.version,
        actorId,
        event.title,
        event.public_id,
        reason ?? null,
      ],
    );
  }
  async audit(
    db: PoolClient,
    event: OperationalEvent,
    actorId: string | null,
    action: string,
    requestId: string,
  ) {
    await db.query(
      `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,organization_id,request_id,after_redacted) VALUES($1,$2,$3,'EVENT',$4,$5,$6,$7)`,
      [
        actorId ? 'USER' : 'SYSTEM',
        actorId,
        action,
        event.id,
        event.organization_id,
        requestId,
        JSON.stringify({ version: event.version, status: event.status }),
      ],
    );
  }
  async job(db: PoolClient) {
    return (
      await db.query<OperationJob>(
        `SELECT id::text,type,aggregate_id::text,aggregate_version,payload_minimal FROM outbox_messages WHERE type IN ('EVENT_CANCELLED','EVENT_UPDATED') AND status='PENDING' AND available_at<=clock_timestamp() ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      )
    ).rows[0];
  }
  async next(db: PoolClient, job: OperationJob) {
    const sql =
      job.type === 'EVENT_CANCELLED'
        ? `SELECT h.id::text,h.customer_id::text FROM seat_holds h JOIN event_sessions s ON s.id=h.session_id WHERE s.event_id=$1 AND h.id>$2 ORDER BY h.id LIMIT 1`
        : `SELECT b.customer_id::text AS id,b.customer_id::text FROM bookings b WHERE b.event_id=$1 AND b.status IN ('CONFIRMED','REFUNDED') AND b.confirmed_at<=$3::timestamptz AND b.customer_id>$2 ORDER BY b.customer_id LIMIT 1`;
    return (
      await db.query<{ id: string; customer_id: string }>(
        sql,
        job.type === 'EVENT_CANCELLED'
          ? [job.aggregate_id, job.payload_minimal.afterId ?? '0']
          : [job.aggregate_id, job.payload_minimal.afterId ?? '0', job.payload_minimal.changedAt],
      )
    ).rows[0];
  }
  async lockUsers(db: PoolClient, ids: string[]) {
    const sorted = [...new Set(ids)].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    for (const id of sorted) await db.query('SELECT id FROM users WHERE id=$1 FOR KEY SHARE', [id]);
  }
  async notify(db: PoolClient, job: OperationJob, userId: string) {
    await db.query(
      `INSERT INTO notifications(recipient_user_id,type,event_id,event_version,payload_redacted) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [
        userId,
        job.type,
        job.aggregate_id,
        job.aggregate_version,
        JSON.stringify({
          eventId: job.payload_minimal.eventId,
          title: job.payload_minimal.title,
          reason: job.payload_minimal.reason ?? null,
        }),
      ],
    );
  }
  async advance(db: PoolClient, job: OperationJob, id?: string) {
    await db.query(
      `UPDATE outbox_messages SET status=$2,attempts=attempts+1,payload_minimal=payload_minimal||jsonb_build_object('afterId',$3::text),last_error_code=NULL WHERE id=$1`,
      [job.id, id ? 'PENDING' : 'DONE', id ?? job.payload_minimal.afterId ?? '0'],
    );
  }
  async progress(db: PoolClient, eventId: string) {
    return (
      await db.query(
        "SELECT type,aggregate_version AS version,status,attempts,last_error_code AS \"lastErrorCode\" FROM outbox_messages WHERE aggregate_type='EVENT' AND aggregate_id=$1 AND type IN ('EVENT_CANCELLED','EVENT_UPDATED') ORDER BY id DESC LIMIT 100",
        [eventId],
      )
    ).rows;
  }
  async defer(db: PoolClient, id: string) {
    await db.query(
      "UPDATE outbox_messages SET attempts=attempts+1,last_error_code='EVENT_OPERATIONS_FAILED',available_at=clock_timestamp()+interval '15 seconds' WHERE id=$1 AND status='PENDING'",
      [id],
    );
  }
}
