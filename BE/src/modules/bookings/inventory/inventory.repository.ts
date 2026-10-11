import type { PoolClient } from 'pg';
import type { InventorySeat } from './inventory.schema.js';

export function publicSessions(db: PoolClient, publicId: string) {
  return db.query(
    `SELECT s.id::text,s.starts_at AS "startsAt",s.ends_at AS "endsAt",s.timezone,
      s.sale_opens_at AS "saleOpensAt",s.sale_closes_at AS "saleClosesAt",s.status,
      s.status='SCHEDULED' AND s.sale_opens_at<=clock_timestamp() AND clock_timestamp()<s.sale_closes_at
        AND clock_timestamp()<s.starts_at AS "saleOpen"
      FROM event_sessions s JOIN events e ON e.id=s.event_id JOIN event_publications ep ON ep.event_id=e.id
      JOIN organizations o ON o.id=e.organization_id WHERE ep.public_id=$1 AND e.status='PUBLISHED'
        AND o.status='APPROVED' AND ep.published_at<=clock_timestamp() ORDER BY s.starts_at,s.id`,
    [publicId],
  );
}

export function publicSeats(db: PoolClient, sessionId: string, time: Date) {
  return db.query<InventorySeat>(
    `SELECT ss.id::text,ss.price_minor::text AS "priceMinor",ss.currency,
      ls.code||'-'||lr.code||'-'||s.number AS label,s.map_x AS x,s.map_y AS y,
      tt.code AS "ticketTypeCode",tt.name AS "ticketTypeName",
      CASE WHEN ss.status='HELD' AND ss.hold_expires_at<=$2 THEN 'AVAILABLE' ELSE ss.status END AS availability
      FROM session_seats ss JOIN seats s ON s.id=ss.seat_id JOIN layout_rows lr ON lr.id=s.row_id
      JOIN layout_sections ls ON ls.id=lr.section_id JOIN ticket_types tt ON tt.id=ss.ticket_type_id
      WHERE ss.session_id=$1 AND s.is_active=TRUE ORDER BY ss.id`,
    [sessionId, time],
  );
}

export function availabilityCounts(db: PoolClient, sessionId: string, time: Date) {
  return db.query<{ total: number; sold: number; available: number }>(
    `SELECT count(*)::int AS total,
      count(*) FILTER (WHERE status='SOLD')::int AS sold,
      count(*) FILTER (WHERE status='AVAILABLE' OR (status='HELD' AND hold_expires_at<=$2))::int AS available
      FROM session_seats ss JOIN seats physical ON physical.id=ss.seat_id WHERE ss.session_id=$1 AND physical.is_active=TRUE`,
    [sessionId, time],
  );
}
