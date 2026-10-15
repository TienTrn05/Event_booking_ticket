import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import type { LayoutInput, ZoneLayoutInput } from '../management/event-management.schema.js';
import type { SaleChangeInput } from './sale-change.schema.js';
export type SaleContext = {
  event_id: string;
  organization_id: string;
  event_status: string;
  event_version: number;
  ticketing_mode: string;
  session_id: string;
  session_status: string;
  starts_at: Date;
  sale_opens_at: Date;
  sale_closes_at: Date;
  layout_id: string;
  venue_id: string;
  canvas_width: string;
  canvas_height: string;
  max_capacity: number;
  capacity_snapshot: number;
  geometry_json: { stage: LayoutInput['stage']; blocked: LayoutInput['blocked'] };
};
export type SaleRequest = {
  id: string;
  event_id: string;
  organization_id: string;
  status: string;
  version: number;
  event_version: number;
  snapshot_json: SaleChangeInput;
  request_type: string;
  reason: string;
  decision_reason: string | null;
};
export class SaleChangeRepository {
  async context(db: PoolClient, eventId: string, sessionId: string, lock = false) {
    return (
      await db.query<SaleContext>(
        `SELECT e.id::text AS event_id,e.organization_id::text,e.status AS event_status,e.version AS event_version,e.ticketing_mode,s.id::text AS session_id,s.status AS session_status,s.starts_at,s.sale_opens_at,s.sale_closes_at,s.layout_id::text,s.venue_id::text,l.canvas_width::text,l.canvas_height::text,v.max_capacity,l.capacity_snapshot,l.geometry_json FROM events e JOIN event_sessions s ON s.event_id=e.id JOIN seat_layouts l ON l.id=s.layout_id JOIN venues v ON v.id=s.venue_id WHERE e.id=$1 AND s.id=$2 AND v.status='ACTIVE' ${lock ? 'FOR UPDATE OF e,s,l' : ''}`,
        [eventId, sessionId],
      )
    ).rows[0];
  }
  async now(db: PoolClient) {
    return (await db.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]!.now;
  }
  async request(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<SaleRequest>(
        `SELECT id::text,event_id::text,organization_id::text,status,version,event_version,snapshot_json,request_type,reason,decision_reason FROM event_change_requests WHERE id=$1 AND request_type IN ('CAPACITY','NEW_SALE_WAVE') ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async pending(db: PoolClient, eventId: string) {
    return !!(
      await db.query(
        "SELECT id FROM event_change_requests WHERE event_id=$1 AND request_type IN ('CAPACITY','NEW_SALE_WAVE') AND status='PENDING'",
        [eventId],
      )
    ).rowCount;
  }
  async create(db: PoolClient, actorId: string, c: SaleContext, input: SaleChangeInput) {
    return (
      await db.query<{ id: string }>(
        `INSERT INTO event_change_requests(public_id,event_id,organization_id,requested_by,request_type,reason,impact_summary,requested_at,event_version,snapshot_json) VALUES($1,$2,$3,$4,$5,$6,'Approved delta only; existing schedule, seats, prices and sold history preserved',clock_timestamp(),$7,$8) RETURNING id::text`,
        [
          'sale-' + randomUUID(),
          c.event_id,
          c.organization_id,
          actorId,
          input.kind,
          input.reason,
          c.event_version,
          JSON.stringify(input),
        ],
      )
    ).rows[0]!.id;
  }
  async types(db: PoolClient, sessionId: string) {
    return (
      await db.query<{ id: string }>('SELECT id::text FROM ticket_types WHERE session_id=$1', [
        sessionId,
      ])
    ).rows.map((r) => r.id);
  }
  async seats(db: PoolClient, layoutId: string) {
    return (
      await db.query<LayoutInput['seats'][number] & { id: string }>(
        `SELECT s.id::text,sec.name AS section,r.code AS row,s.number,s.map_x::float8 AS x,s.map_y::float8 AS y,s.width::float8 AS width,s.height::float8 AS height FROM seats s JOIN layout_rows r ON r.id=s.row_id JOIN layout_sections sec ON sec.id=r.section_id WHERE s.layout_id=$1 ORDER BY s.id`,
        [layoutId],
      )
    ).rows;
  }
  async zones(db: PoolClient, layoutId: string) {
    return (
      await db.query<ZoneLayoutInput['zones'][number] & { id: string }>(
        `SELECT id::text,code,name,capacity,(geometry_json->>'x')::float8 AS x,(geometry_json->>'y')::float8 AS y,(geometry_json->>'width')::float8 AS width,(geometry_json->>'height')::float8 AS height FROM layout_sections WHERE layout_id=$1 AND capacity IS NOT NULL ORDER BY id`,
        [layoutId],
      )
    ).rows;
  }
  async inventory(db: PoolClient, sessionId: string) {
    return (
      await db.query<{
        seat_id: string | null;
        section_id: string | null;
        inventory_number: number | null;
      }>(
        'SELECT seat_id::text,section_id::text,inventory_number FROM session_seats WHERE session_id=$1',
        [sessionId],
      )
    ).rows;
  }
  private async price(
    db: PoolClient,
    c: SaleContext,
    target: { seatId?: string; sectionId?: string; ticketTypeId: string; priceMinor: string },
  ) {
    await db.query(
      'UPDATE event_sessions SET pricing_config=pricing_config||$2::jsonb WHERE id=$1',
      [c.session_id, JSON.stringify([{ ...target, currency: 'VND' }])],
    );
  }
  async apply(db: PoolClient, c: SaleContext, input: SaleChangeInput) {
    if (input.kind === 'NEW_SALE_WAVE') {
      await db.query('UPDATE event_sessions SET sale_opens_at=$2,sale_closes_at=$3 WHERE id=$1', [
        c.session_id,
        input.saleOpensAt,
        input.saleClosesAt,
      ]);
    } else if (c.ticketing_mode === 'NUMBERED')
      for (const seat of input.seats) {
        let section = (
          await db.query<{ id: string }>(
            'SELECT id::text FROM layout_sections WHERE layout_id=$1 AND name=$2 ORDER BY id LIMIT 1',
            [c.layout_id, seat.section],
          )
        ).rows[0]?.id;
        if (!section)
          section = (
            await db.query<{ id: string }>(
              'INSERT INTO layout_sections(layout_id,code,name) VALUES($1,$2,$3) RETURNING id::text',
              [c.layout_id, 'S' + randomUUID(), seat.section],
            )
          ).rows[0]!.id;
        let row = (
          await db.query<{ id: string }>(
            'SELECT id::text FROM layout_rows WHERE section_id=$1 AND code=$2',
            [section, seat.row],
          )
        ).rows[0]?.id;
        if (!row)
          row = (
            await db.query<{ id: string }>(
              'INSERT INTO layout_rows(section_id,layout_id,code) VALUES($1,$2,$3) RETURNING id::text',
              [section, c.layout_id, seat.row],
            )
          ).rows[0]!.id;
        const existing = (await this.seats(db, c.layout_id)).find(
          (s) => s.section === seat.section && s.row === seat.row && s.number === seat.number,
        );
        const physical =
          existing?.id ??
          (
            await db.query<{ id: string }>(
              'INSERT INTO seats(row_id,layout_id,number,map_x,map_y,width,height) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::text',
              [row, c.layout_id, seat.number, seat.x, seat.y, seat.width, seat.height],
            )
          ).rows[0]!.id;
        await db.query(
          "INSERT INTO session_seats(session_id,layout_id,seat_id,ticket_type_id,price_minor,currency) VALUES($1,$2,$3,$4,$5,'VND')",
          [c.session_id, c.layout_id, physical, seat.ticketTypeId, seat.priceMinor],
        );
        await this.price(db, c, {
          seatId: physical,
          ticketTypeId: seat.ticketTypeId,
          priceMinor: seat.priceMinor,
        });
      }
    else {
      for (const increase of [...input.increases].sort((a, b) =>
        BigInt(a.sectionId) < BigInt(b.sectionId) ? -1 : 1,
      )) {
        const current = (
          await db.query<{ capacity: number; ticket_type_id: string; price_minor: string }>(
            `SELECT (SELECT max(i.inventory_number) FROM session_seats i WHERE i.session_id=$2 AND i.section_id=z.id) AS capacity,ss.ticket_type_id::text,ss.price_minor::text FROM layout_sections z JOIN session_seats ss ON ss.section_id=z.id AND ss.session_id=$2 WHERE z.id=$1 AND z.layout_id=$3 ORDER BY ss.id LIMIT 1`,
            [increase.sectionId, c.session_id, c.layout_id],
          )
        ).rows[0]!;
        await db.query('UPDATE layout_sections SET capacity=GREATEST(capacity,$2) WHERE id=$1', [
          increase.sectionId,
          increase.capacity,
        ]);
        await db.query(
          "INSERT INTO session_seats(session_id,layout_id,section_id,inventory_number,ticket_type_id,price_minor,currency) SELECT $1,$2,$3,n,$6,$7,'VND' FROM generate_series($4::int,$5::int) n",
          [
            c.session_id,
            c.layout_id,
            increase.sectionId,
            current.capacity + 1,
            increase.capacity,
            current.ticket_type_id,
            current.price_minor,
          ],
        );
      }
      for (const zone of input.zones) {
        const id = (
          await db.query<{ id: string }>(
            'INSERT INTO layout_sections(layout_id,code,name,capacity,geometry_json) VALUES($1,$2,$3,$4,$5) RETURNING id::text',
            [
              c.layout_id,
              zone.code,
              zone.name,
              zone.capacity,
              JSON.stringify({ x: zone.x, y: zone.y, width: zone.width, height: zone.height }),
            ],
          )
        ).rows[0]!.id;
        await db.query(
          "INSERT INTO session_seats(session_id,layout_id,section_id,inventory_number,ticket_type_id,price_minor,currency) SELECT $1,$2,$3,n,$5,$6,'VND' FROM generate_series(1,$4::int) n",
          [c.session_id, c.layout_id, id, zone.capacity, zone.ticketTypeId, zone.priceMinor],
        );
        await this.price(db, c, {
          sectionId: id,
          ticketTypeId: zone.ticketTypeId,
          priceMinor: zone.priceMinor,
        });
      }
    }
    await db.query('UPDATE event_sessions SET version=version+1 WHERE id=$1', [c.session_id]);
    if (input.kind === 'CAPACITY')
      await db.query('UPDATE seat_layouts SET version=version+1 WHERE id=$1', [c.layout_id]);
    await db.query(
      "UPDATE events SET version=version+1,catalog_status='ON_SALE',publication_updated_at=clock_timestamp() WHERE id=$1",
      [c.event_id],
    );
  }
  async decide(
    db: PoolClient,
    id: string,
    userId: string,
    status: string,
    reason: string,
    snapshot: unknown,
  ) {
    await db.query(
      "UPDATE event_change_requests SET status=$2::varchar,version=version+1,decided_by=$3,decided_at=clock_timestamp(),decision_reason=$4,visible_on_catalog=($2::varchar='APPROVED'),reputation_snapshot=$5 WHERE id=$1",
      [id, status, userId, reason, JSON.stringify(snapshot)],
    );
  }
  async list(
    db: PoolClient,
    eventId: string | null,
    orgId: string | null,
    page: number,
    size: number,
  ) {
    return (
      await db.query<{ items: unknown[]; total: number }>(
        `WITH matches AS(SELECT id::text,event_id::text AS "eventId",request_type AS kind,status,version,event_version AS "eventVersion",snapshot_json AS proposed,reason,decision_reason AS "decisionReason",reputation_snapshot AS reputation FROM event_change_requests WHERE request_type IN ('CAPACITY','NEW_SALE_WAVE') AND ($1::bigint IS NULL OR event_id=$1) AND ($2::bigint IS NULL OR organization_id=$2)),page_rows AS(SELECT * FROM matches ORDER BY id::bigint DESC LIMIT $3 OFFSET $4) SELECT (SELECT count(*)::int FROM matches) AS total,COALESCE((SELECT jsonb_agg(p ORDER BY p.id::bigint DESC) FROM page_rows p),'[]'::jsonb) AS items`,
        [eventId, orgId, size, (page - 1) * size],
      )
    ).rows[0]!;
  }
  async audit(
    db: PoolClient,
    c: SaleContext,
    userId: string,
    id: string,
    action: string,
    requestId: string,
  ) {
    await db.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,organization_id,request_id,after_redacted) VALUES('USER',$1,$2,'EVENT_CHANGE',$3,$4,$5,jsonb_build_object('eventId',$6::text,'eventVersion',$7::int))",
      [userId, action, id, c.organization_id, requestId, c.event_id, c.event_version],
    );
  }
}
