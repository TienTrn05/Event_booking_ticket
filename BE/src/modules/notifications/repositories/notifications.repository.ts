import type { PoolClient } from 'pg';
import { AppError } from '../../../shared/errors/app-error.js';
import type { PageInput } from '../../../shared/validation/common.schema.js';
const visible = `AND (n.type<>'FOLLOWED_ORGANIZER_EVENT' OR EXISTS (
  SELECT 1 FROM events e  JOIN organizations o ON o.id=e.organization_id
  WHERE e.id=n.event_id AND e.status='PUBLISHED' AND e.published_at<=CURRENT_TIMESTAMP AND o.status='APPROVED' AND o.public_id IS NOT NULL))`;
export const notificationsRepository = {
  async inbox(db: PoolClient, userId: string, page: PageInput) {
    const { rows } = await db.query(
      `SELECT n.id::text,n.type,n.payload_redacted AS payload,
      n.read_at AS "readAt",n.created_at AS "createdAt" FROM notifications n
      WHERE n.recipient_user_id=$1 ${visible} ORDER BY n.created_at DESC,n.id DESC LIMIT $2 OFFSET $3`,
      [userId, page.pageSize, (page.page - 1) * page.pageSize],
    );
    const counts = await db.query<{ total: number; unreadCount: number }>(
      `SELECT count(*)::int AS total,
      count(*) FILTER(WHERE n.read_at IS NULL)::int AS "unreadCount" FROM notifications n
      WHERE n.recipient_user_id=$1 ${visible}`,
      [userId],
    );
    return { items: rows, ...counts.rows[0]! };
  },
  async read(db: PoolClient, userId: string, id: string) {
    const result = await db.query(
      `UPDATE notifications n SET read_at=COALESCE(read_at,clock_timestamp())
      WHERE n.id=$1 AND n.recipient_user_id=$2 ${visible}`,
      [id, userId],
    );
    if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thông báo.');
  },
  async dispatch(db: PoolClient) {
    const { rows } = await db.query<{
      id: string;
      aggregate_id: string;
      payload_minimal: { publishedAt: string; afterUserId?: string };
    }>(`SELECT id::text,aggregate_id::text,payload_minimal
      FROM outbox_messages WHERE type='FOLLOWED_ORGANIZER_EVENT' AND status='PENDING'
      AND available_at<=clock_timestamp() ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`);
    const message = rows[0];
    if (!message) return false;
    const batch = await db.query<{ last: string | null; count: number }>(
      `WITH eligible AS (SELECT f.user_id,e.id AS event_id,
        jsonb_build_object('eventId',e.public_id,'organizerId',o.public_id,'title',e.title) AS payload
      FROM events e
      JOIN organizations o ON o.id=e.organization_id AND o.status='APPROVED' AND o.public_id IS NOT NULL
      JOIN organization_follows f ON f.organization_id=o.id
      JOIN users u ON u.id=f.user_id AND u.status='ACTIVE'
      WHERE e.id=$1 AND e.status='PUBLISHED' AND e.published_at<=clock_timestamp()
        AND f.user_id>$3::bigint AND f.notifications_enabled AND f.created_at<=$2::timestamptz AND f.notifications_enabled_at<=$2::timestamptz
        AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=f.user_id AND r.code='CUSTOMER')
      ORDER BY f.user_id LIMIT 500), inserted AS (
        INSERT INTO notifications(recipient_user_id,type,event_id,payload_redacted)
        SELECT user_id,'FOLLOWED_ORGANIZER_EVENT',event_id,payload FROM eligible
        ON CONFLICT DO NOTHING RETURNING id)
      SELECT max(user_id)::text AS last,count(*)::int AS count FROM eligible`,
      [
        message.aggregate_id,
        message.payload_minimal.publishedAt,
        message.payload_minimal.afterUserId ?? '0',
      ],
    );
    await db.query(
      `UPDATE outbox_messages SET status=$2,attempts=attempts+1,last_error_code=NULL,
        payload_minimal=payload_minimal||jsonb_build_object('afterUserId',$3::text) WHERE id=$1`,
      [
        message.id,
        batch.rows[0]!.count === 500 ? 'PENDING' : 'DONE',
        batch.rows[0]!.last ?? message.payload_minimal.afterUserId ?? '0',
      ],
    );
    return true;
  },
};
