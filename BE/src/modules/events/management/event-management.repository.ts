import { randomUUID } from 'node:crypto';
import { ReputationRepository } from '../../reputation/reputation.repository.js';
import type { PoolClient } from 'pg';
import { AppError } from '../../../shared/errors/app-error.js';
import type {
  DraftInput,
  ZoneLayoutInput,
  ZonePricingInput,
  LayoutInput,
  SessionInput,
  PricingInput,
  ReviewHistoryQuery,
} from './event-management.schema.js';
export type EventRow = {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  category_id: string;
  description: string;
  minimum_age: number | null;
  cover_image_url: string | null;
  status: string;
  version: number;
  ticketing_mode: string;
};
export type SessionRow = {
  id: string;
  event_id: string;
  layout_id: string;
  venue_id: string;
  starts_at: Date;
  timezone: string;
  pricing_config: PricingInput['prices'] | ZonePricingInput['prices'] | null;
};
export type EventReviewDetail = {
  id: string;
  event_id: string;
  event_version: number;
  status: string;
  snapshot_json: unknown;
  reputation_snapshot: unknown;
  submitted_at: Date;
  expires_at: Date;
  notice: unknown;
};
export class EventManagementRepository {
  async removeDraft(db: PoolClient, id: string) {
    try {
      await db.query('DELETE FROM events WHERE id=$1', [id]);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23503')
        throw new AppError(
          409,
          'EVENT_HAS_DEPENDENCIES',
          'Chỉ xóa nháp chưa có dữ liệu phụ thuộc.',
        );
      throw error;
    }
  }
  async reasonQueue(db: PoolClient, limit: number, offset: number) {
    return (
      await db.query(
        `SELECT n.id::text,n.review_id::text AS "reviewId",n.version,n.status,r.event_id::text AS "eventId",
        e.title AS "eventTitle",o.name AS "organizationName",r.status AS "reviewStatus",r.expires_at AS "expiresAt"
       FROM reason_notices n JOIN event_reviews r ON r.id=n.review_id JOIN events e ON e.id=r.event_id
       JOIN organizations o ON o.id=e.organization_id WHERE n.status='DRAFT'
       ORDER BY r.expires_at,n.id LIMIT $1 OFFSET $2`,
        [limit, offset],
      )
    ).rows;
  }
  async reasonDetail(db: PoolClient, reviewId: string) {
    return (
      await db.query<{
        reviewId: string;
        eventId: string;
        eventTitle: string;
        organizationName: string;
        reviewStatus: string;
        notice: {
          id: string;
          version: number;
          status: string;
          reasonCode: string | null;
          reason: string | null;
          guidance: string | null;
        } | null;
      }>(
        `SELECT r.id::text AS "reviewId",r.event_id::text AS "eventId",e.title AS "eventTitle",
      o.name AS "organizationName",r.status AS "reviewStatus",r.submitted_at AS "submittedAt",r.expires_at AS "expiresAt",
      CASE WHEN n.id IS NULL THEN NULL ELSE jsonb_build_object('id',n.id::text,'version',n.version,
        'status',n.status,'reasonCode',n.reason_code,'reason',n.reason_text,'guidance',n.guidance,
        'authoredBy',n.authored_by::text,'sentAt',n.sent_at) END AS notice
      FROM event_reviews r JOIN events e ON e.id=r.event_id JOIN organizations o ON o.id=e.organization_id
      LEFT JOIN reason_notices n ON n.review_id=r.id WHERE r.id=$1`,
        [reviewId],
      )
    ).rows[0];
  }
  async saveReasonDraft(
    db: PoolClient,
    reviewId: string,
    actorId: string,
    input: { version: number; reasonCode: string; reason: string; guidance: string },
  ) {
    await db.query('INSERT INTO reason_notices(review_id) VALUES($1) ON CONFLICT DO NOTHING', [
      reviewId,
    ]);
    const row = (
      await db.query<{ id: string; version: number; status: string }>(
        `UPDATE reason_notices SET reason_code=$3,reason_text=$4,guidance=$5,authored_by=$6,version=version+1
       WHERE review_id=$1 AND status='DRAFT' AND version=$2 RETURNING id::text,version,status`,
        [reviewId, input.version, input.reasonCode, input.reason, input.guidance, actorId],
      )
    ).rows[0];
    if (!row)
      throw new AppError(409, 'NOTICE_VERSION_CONFLICT', 'Phiếu không còn nháp đúng version.');
    return row;
  }
  async history(db: PoolClient, q: ReviewHistoryQuery) {
    return (
      await db.query<{ items: Record<string, unknown>[]; total: number }>(
        `WITH matches AS (
      SELECT r.id::text,r.event_id::text AS "eventId",e.organization_id::text AS "organizationId",e.title AS "eventTitle",o.name AS "organizationName",r.event_version AS "eventVersion",r.status,r.submitted_at AS "submittedAt",r.expires_at AS "expiresAt",r.decided_at AS "decidedAt",r.reputation_snapshot AS reputation
      FROM event_reviews r JOIN events e ON e.id=r.event_id JOIN organizations o ON o.id=e.organization_id
      WHERE ($1::bigint IS NULL OR r.event_id=$1) AND ($2::bigint IS NULL OR e.organization_id=$2) AND ($3::text IS NULL OR r.status=$3)),
      page_rows AS(SELECT * FROM matches ORDER BY "submittedAt" DESC,id::bigint DESC LIMIT $4 OFFSET $5)
      SELECT (SELECT count(*)::int FROM matches) AS total,COALESCE((SELECT jsonb_agg(p ORDER BY p."submittedAt" DESC,p.id::bigint DESC) FROM page_rows p),'[]'::jsonb) AS items`,
        [
          q.eventId ?? null,
          q.organizationId ?? null,
          q.status ?? null,
          q.pageSize,
          (q.page - 1) * q.pageSize,
        ],
      )
    ).rows[0]!;
  }
  async options(db: PoolClient) {
    return {
      categories: (
        await db.query(
          `SELECT id::text,name,slug FROM event_categories WHERE is_active ORDER BY id`,
        )
      ).rows,
      venues: (
        await db.query(
          `SELECT id::text,name,city,timezone,version,canvas_width AS "canvasWidth",canvas_height AS "canvasHeight",bounds_json AS bounds,max_capacity AS "maxCapacity" FROM venues WHERE status='ACTIVE' ORDER BY city,name LIMIT 100`,
        )
      ).rows,
    };
  }
  async reviewDetail(db: PoolClient, id: string) {
    return (
      await db.query<EventReviewDetail>(
        `SELECT r.id::text,r.event_id::text,r.event_version,r.status,r.snapshot_json,r.reputation_snapshot,r.submitted_at,r.expires_at,(SELECT jsonb_build_object('id',n.id::text,'version',n.version,'status',n.status,'reason',n.reason_text,'guidance',n.guidance) FROM reason_notices n WHERE n.review_id=r.id) AS notice FROM event_reviews r WHERE r.id=$1`,
        [id],
      )
    ).rows[0];
  }
  async sendReason(
    db: PoolClient,
    reviewId: string,
    actorId: string,
    input: { version: number; reason: string; guidance: string; reasonCode?: string | undefined },
  ) {
    const notice = (
      await db.query<{ id: string; version: number; status: string }>(
        `SELECT id::text,version,status FROM reason_notices WHERE review_id=$1 FOR UPDATE`,
        [reviewId],
      )
    ).rows[0];
    if (!notice || notice.status !== 'DRAFT' || notice.version !== input.version)
      throw new AppError(
        409,
        'NOTICE_VERSION_CONFLICT',
        'Thông báo lý do không còn nháp đúng version.',
      );
    await db.query(
      `UPDATE reason_notices SET reason_code=$5,reason_text=$2,guidance=$3,status='SENT',authored_by=$4,sent_at=clock_timestamp(),version=version+1 WHERE id=$1`,
      [notice.id, input.reason, input.guidance, actorId, input.reasonCode ?? 'REVIEW_EXPIRED'],
    );
    await db.query(
      `INSERT INTO notifications(recipient_user_id,type,review_id,reason_notice_id,payload_redacted) SELECT submitted_by,'REASON_NOTICE',id,$2,jsonb_build_object('reviewId',id::text,'reason',(SELECT reason_text FROM reason_notices WHERE id=$2),'guidance',(SELECT guidance FROM reason_notices WHERE id=$2)) FROM event_reviews WHERE id=$1 ON CONFLICT DO NOTHING`,
      [reviewId, notice.id],
    );
    return notice.id;
  }
  async organization(db: PoolClient, id: string) {
    return (
      await db.query<{ status: string }>('SELECT status FROM organizations WHERE id=$1 FOR SHARE', [
        id,
      ])
    ).rows[0];
  }
  async reviewLocator(db: PoolClient, id: string) {
    return (
      await db.query<{ event_id: string }>('SELECT event_id::text FROM event_reviews WHERE id=$1', [
        id,
      ])
    ).rows[0];
  }
  async event(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<EventRow>(
        `SELECT id::text,organization_id::text,created_by::text,title,category_id::text,description,minimum_age,cover_image_url,status,version,ticketing_mode FROM events WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async create(db: PoolClient, actorId: string, input: DraftInput) {
    await this.category(db, input.categoryId);
    return (
      await db.query<{ id: string }>(
        `INSERT INTO events(organization_id,created_by,category_id,title,slug,description,minimum_age,ticketing_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`,
        [
          input.organizationId,
          actorId,
          input.categoryId,
          input.title,
          'event-' + randomUUID(),
          input.description,
          input.minimumAge,
          input.ticketingMode,
        ],
      )
    ).rows[0]!.id;
  }
  async category(db: PoolClient, id: string) {
    if (
      !(await db.query('SELECT id FROM event_categories WHERE id=$1 AND is_active FOR SHARE', [id]))
        .rowCount
    )
      throw new AppError(422, 'UNKNOWN_CATEGORY', 'Danh mục không hợp lệ.');
  }
  async update(
    db: PoolClient,
    id: string,
    input: Omit<DraftInput, 'organizationId' | 'ticketingMode'>,
  ) {
    await this.category(db, input.categoryId);
    await db.query(
      'UPDATE events SET title=$2,description=$3,category_id=$4,minimum_age=$5 WHERE id=$1',
      [id, input.title, input.description, input.categoryId, input.minimumAge],
    );
  }
  async bump(db: PoolClient, id: string) {
    await db.query('UPDATE events SET version=version+1 WHERE id=$1', [id]);
  }
  async list(db: PoolClient, userId: string) {
    return (
      await db.query(
        `SELECT e.id::text,e.organization_id::text AS "organizationId",e.title,e.status,e.version,e.ticketing_mode AS "ticketingMode" FROM events e JOIN organizations o ON o.id=e.organization_id JOIN organization_memberships m ON m.organization_id=o.id WHERE m.user_id=$1 AND m.status IN ('PENDING','ACTIVE') AND o.status IN ('PENDING_REVIEW','APPROVED','REJECTED') ORDER BY e.id DESC LIMIT 100`,
        [userId],
      )
    ).rows;
  }
  async graph(db: PoolClient, id: string) {
    return {
      event: await this.event(db, id),
      layouts: (
        await db.query(
          'SELECT id::text,venue_id::text,version,status,geometry_json,canvas_width,canvas_height,ticketing_mode FROM seat_layouts WHERE event_id=$1 ORDER BY id',
          [id],
        )
      ).rows,
      zones: (
        await db.query(
          'SELECT z.id::text,z.layout_id::text,z.code,z.name,z.capacity,z.geometry_json FROM layout_sections z JOIN seat_layouts l ON l.id=z.layout_id WHERE l.event_id=$1 AND z.capacity IS NOT NULL ORDER BY z.id',
          [id],
        )
      ).rows,
      seats: (
        await db.query(
          `SELECT s.id::text,s.layout_id::text,sec.name AS section,r.code AS row,s.number,s.map_x,s.map_y,s.width,s.height FROM seats s JOIN seat_layouts l ON l.id=s.layout_id JOIN layout_rows r ON r.id=s.row_id JOIN layout_sections sec ON sec.id=r.section_id WHERE l.event_id=$1 ORDER BY s.id`,
          [id],
        )
      ).rows,
      sessions: await this.sessions(db, id),
      ticketTypes: (
        await db.query(
          'SELECT t.id::text,t.session_id::text,t.code,t.name FROM ticket_types t JOIN event_sessions s ON s.id=t.session_id WHERE s.event_id=$1 ORDER BY t.id',
          [id],
        )
      ).rows,
      reviews: (
        await db.query(
          'SELECT id::text,event_version,status,submitted_at,expires_at FROM event_reviews WHERE event_id=$1 ORDER BY id DESC',
          [id],
        )
      ).rows,
    };
  }
  async venue(db: PoolClient, id: string) {
    const row = (
      await db.query<{
        id: string;
        canvas_width: string;
        canvas_height: string;
        max_capacity: number;
        version: number;
        bounds_json: Record<string, unknown>;
        timezone: string;
      }>(
        "SELECT id::text,canvas_width,canvas_height,max_capacity,version,bounds_json,timezone FROM venues WHERE id=$1 AND status='ACTIVE' FOR SHARE",
        [id],
      )
    ).rows[0];
    if (!row) throw new AppError(422, 'VENUE_UNAVAILABLE', 'Địa điểm không khả dụng.');
    return row;
  }
  async layout(
    db: PoolClient,
    event: EventRow,
    input: LayoutInput,
    venue: Awaited<ReturnType<EventManagementRepository['venue']>>,
  ) {
    const id = (
      await db.query<{ id: string }>(
        `INSERT INTO seat_layouts(organization_id,event_id,venue_id,venue_version,geometry_json,bounds_snapshot,canvas_width,canvas_height,capacity_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text`,
        [
          event.organization_id,
          event.id,
          venue.id,
          venue.version,
          JSON.stringify({ stage: input.stage, blocked: input.blocked }),
          JSON.stringify(venue.bounds_json),
          venue.canvas_width,
          venue.canvas_height,
          venue.max_capacity,
        ],
      )
    ).rows[0]!.id;
    const sections = new Map<string, string>(),
      rows = new Map<string, string>();
    for (const seat of input.seats) {
      let section = sections.get(seat.section);
      if (!section) {
        section = (
          await db.query<{ id: string }>(
            'INSERT INTO layout_sections(layout_id,code,name) VALUES($1,$2,$3) RETURNING id::text',
            [id, 'S' + sections.size, seat.section],
          )
        ).rows[0]!.id;
        sections.set(seat.section, section);
      }
      const key = JSON.stringify([seat.section, seat.row]);
      let row = rows.get(key);
      if (!row) {
        row = (
          await db.query<{ id: string }>(
            'INSERT INTO layout_rows(section_id,layout_id,code) VALUES($1,$2,$3) RETURNING id::text',
            [section, id, seat.row],
          )
        ).rows[0]!.id;
        rows.set(key, row);
      }
      await db.query(
        'INSERT INTO seats(row_id,layout_id,number,map_x,map_y,width,height) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [row, id, seat.number, seat.x, seat.y, seat.width, seat.height],
      );
    }
    return id;
  }
  async zoneLayout(
    db: PoolClient,
    event: EventRow,
    input: ZoneLayoutInput,
    venue: Awaited<ReturnType<EventManagementRepository['venue']>>,
  ) {
    const id = (
      await db.query<{ id: string }>(
        `INSERT INTO seat_layouts(organization_id,event_id,venue_id,venue_version,geometry_json,bounds_snapshot,canvas_width,canvas_height,capacity_snapshot,ticketing_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'QUANTITY') RETURNING id::text`,
        [
          event.organization_id,
          event.id,
          venue.id,
          venue.version,
          JSON.stringify({ stage: input.stage, blocked: input.blocked }),
          JSON.stringify(venue.bounds_json),
          venue.canvas_width,
          venue.canvas_height,
          venue.max_capacity,
        ],
      )
    ).rows[0]!.id;
    for (const zone of input.zones)
      await db.query(
        'INSERT INTO layout_sections(layout_id,code,name,capacity,geometry_json) VALUES($1,$2,$3,$4,$5)',
        [
          id,
          zone.code,
          zone.name,
          zone.capacity,
          JSON.stringify({ x: zone.x, y: zone.y, width: zone.width, height: zone.height }),
        ],
      );
    return id;
  }
  async zonePrices(db: PoolClient, session: SessionRow, prices: ZonePricingInput['prices']) {
    const zones = (
      await db.query<{ id: string }>(
        'SELECT id::text FROM layout_sections WHERE layout_id=$1 AND capacity IS NOT NULL ORDER BY id FOR SHARE',
        [session.layout_id],
      )
    ).rows;
    const types = (
      await db.query<{ id: string }>(
        'SELECT id::text FROM ticket_types WHERE session_id=$1 FOR SHARE',
        [session.id],
      )
    ).rows;
    if (
      new Set(prices.map((p) => p.sectionId)).size !== zones.length ||
      prices.length !== zones.length ||
      !zones.length ||
      prices.some(
        (p) =>
          !zones.some((z) => z.id === p.sectionId) || !types.some((t) => t.id === p.ticketTypeId),
      )
    )
      throw new AppError(
        422,
        'INCOMPLETE_PRICING',
        'Cần giá đúng một lần cho mỗi khu và loại vé thuộc suất.',
      );
    await db.query('UPDATE event_sessions SET pricing_config=$2,version=version+1 WHERE id=$1', [
      session.id,
      JSON.stringify(prices),
    ]);
  }
  async session(db: PoolClient, id: string, eventId: string) {
    const row = (
      await db.query<SessionRow>(
        'SELECT id::text,event_id::text,layout_id::text,venue_id::text,starts_at,timezone,pricing_config FROM event_sessions WHERE id=$1 AND event_id=$2 FOR UPDATE',
        [id, eventId],
      )
    ).rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy suất.');
    return row;
  }
  async createSession(db: PoolClient, eventId: string, input: SessionInput, sessionId?: string) {
    const layout = (
      await db.query<{ venue_id: string; timezone: string }>(
        `SELECT l.venue_id::text,v.timezone FROM seat_layouts l JOIN venues v ON v.id=l.venue_id JOIN events e ON e.id=l.event_id WHERE l.ticketing_mode=e.ticketing_mode AND l.id=$1 AND l.event_id=$2 AND l.status='DRAFT' AND v.status='ACTIVE' FOR SHARE OF l,v`,
        [input.layoutId, eventId],
      )
    ).rows[0];
    if (!layout) throw new AppError(422, 'LAYOUT_UNAVAILABLE', 'Sơ đồ không khả dụng.');
    if (sessionId) {
      await this.session(db, sessionId, eventId);
      await db.query(
        `UPDATE event_sessions SET pricing_config=CASE WHEN layout_id=$2 THEN pricing_config ELSE NULL END,layout_id=$2,venue_id=$3,timezone=$4,starts_at=$5,ends_at=$6,sale_opens_at=$7,sale_closes_at=$8,counter_opens_at=$9,counter_closes_at=$10,admission_opens_at=$11,admission_closes_at=$12,version=version+1 WHERE id=$1`,
        [
          sessionId,
          input.layoutId,
          layout.venue_id,
          layout.timezone,
          input.startsAt,
          input.endsAt,
          input.saleOpensAt,
          input.saleClosesAt,
          input.counterOpensAt,
          input.counterClosesAt,
          input.admissionOpensAt,
          input.admissionClosesAt,
        ],
      );
      return sessionId;
    }
    return (
      await db.query<{ id: string }>(
        `INSERT INTO event_sessions(event_id,layout_id,venue_id,timezone,starts_at,ends_at,sale_opens_at,sale_closes_at,counter_opens_at,counter_closes_at,admission_opens_at,admission_closes_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id::text`,
        [
          eventId,
          input.layoutId,
          layout.venue_id,
          layout.timezone,
          input.startsAt,
          input.endsAt,
          input.saleOpensAt,
          input.saleClosesAt,
          input.counterOpensAt,
          input.counterClosesAt,
          input.admissionOpensAt,
          input.admissionClosesAt,
        ],
      )
    ).rows[0]!.id;
  }
  async type(db: PoolClient, sessionId: string, input: { code: string; name: string }) {
    if (
      (
        await db.query('SELECT id FROM ticket_types WHERE session_id=$1 AND code=$2', [
          sessionId,
          input.code,
        ])
      ).rowCount
    )
      throw new AppError(409, 'TICKET_TYPE_CONFLICT', 'Mã loại vé đã tồn tại.');
    return (
      await db.query<{ id: string }>(
        'INSERT INTO ticket_types(session_id,code,name) VALUES($1,$2,$3) RETURNING id::text',
        [sessionId, input.code, input.name],
      )
    ).rows[0]!.id;
  }
  async prices(db: PoolClient, session: SessionRow, prices: PricingInput['prices']) {
    const seats = (
      await db.query<{ id: string }>(
        'SELECT id::text FROM seats WHERE layout_id=$1 AND is_active ORDER BY id FOR SHARE',
        [session.layout_id],
      )
    ).rows.map((s) => s.id);
    const types = (
      await db.query<{ id: string }>(
        'SELECT id::text FROM ticket_types WHERE session_id=$1 FOR SHARE',
        [session.id],
      )
    ).rows.map((t) => t.id);
    if (
      new Set(prices.map((p) => p.seatId)).size !== prices.length ||
      prices.length !== seats.length ||
      prices.some((p) => !seats.includes(p.seatId) || !types.includes(p.ticketTypeId))
    )
      throw new AppError(
        422,
        'INCOMPLETE_PRICING',
        'Cần giá đúng một lần cho mỗi ghế và loại vé thuộc suất.',
      );
    await db.query('UPDATE event_sessions SET pricing_config=$2,version=version+1 WHERE id=$1', [
      session.id,
      JSON.stringify(prices),
    ]);
  }
  async sessions(db: PoolClient, id: string) {
    return (
      await db.query<SessionRow>(
        'SELECT id::text,event_id::text,layout_id::text,venue_id::text,starts_at,ends_at,timezone,sale_opens_at,sale_closes_at,counter_opens_at,counter_closes_at,admission_opens_at,admission_closes_at,pricing_config,version FROM event_sessions WHERE event_id=$1 ORDER BY starts_at,id FOR UPDATE',
        [id],
      )
    ).rows;
  }
  async submit(db: PoolClient, event: EventRow, actorId: string, snapshot: unknown) {
    const first = (await this.sessions(db, event.id))[0];
    if (!first) throw new AppError(422, 'NO_SESSION', 'Cần ít nhất một suất.');
    const cutoff = (
      await db.query<{ cutoff: Date; now: Date }>(
        `SELECT (($1::timestamptz AT TIME ZONE $2)-interval '1 month') AT TIME ZONE $2 AS cutoff,clock_timestamp() AS now`,
        [first.starts_at, first.timezone],
      )
    ).rows[0]!;
    if (cutoff.now > cutoff.cutoff)
      throw new AppError(
        422,
        'SUBMISSION_TOO_LATE',
        'Cần gửi trước suất sớm nhất ít nhất một tháng lịch.',
      );
    const review = (
      await db.query<{ id: string }>(
        `INSERT INTO event_reviews(event_id,event_version,submitted_by,submitted_at,expires_at,earliest_session_starts_at,submission_cutoff_at,calendar_timezone,snapshot_json) VALUES($1,$2,$3,$4,$4::timestamptz+interval '15 days',$5,$6,$7,$8) RETURNING id::text`,
        [
          event.id,
          event.version,
          actorId,
          cutoff.now,
          first.starts_at,
          cutoff.cutoff,
          first.timezone,
          JSON.stringify(snapshot),
        ],
      )
    ).rows[0]!.id;
    await db.query(
      `UPDATE seat_layouts SET status='FROZEN',frozen_at=clock_timestamp() WHERE event_id=$1 AND status='DRAFT'`,
      [event.id],
    );
    await db.query(`UPDATE events SET status='PENDING_REVIEW' WHERE id=$1`, [event.id]);
    return review;
  }
  async review(db: PoolClient, id: string) {
    return (
      await db.query<{
        id: string;
        event_id: string;
        event_version: number;
        status: string;
        expired: boolean;
        submitted_by: string;
      }>(
        'SELECT id::text,event_id::text,event_version,status,submitted_by::text,expires_at<=clock_timestamp() AS expired FROM event_reviews WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
  }
  async pending(db: PoolClient) {
    return (
      await db.query(
        `SELECT r.id::text,r.event_id::text,r.event_version,r.status,r.expires_at,e.title,o.name AS organization FROM event_reviews r JOIN events e ON e.id=r.event_id JOIN organizations o ON o.id=e.organization_id WHERE r.status='PENDING' ORDER BY r.expires_at,r.id LIMIT 100`,
      )
    ).rows;
  }
  async expired(db: PoolClient) {
    return (
      await db.query<{ id: string; event_id: string }>(
        `SELECT id::text,event_id::text FROM event_reviews WHERE status='PENDING' AND expires_at<=clock_timestamp() ORDER BY id LIMIT 100`,
      )
    ).rows;
  }
  async decide(
    db: PoolClient,
    event: EventRow,
    review: NonNullable<Awaited<ReturnType<EventManagementRepository['review']>>>,
    actorId: string | null,
    action: 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN',
    reason: string,
    guidance: string,
    reasonCode = 'REVIEW_REJECTED',
  ) {
    await db.query(
      'UPDATE event_reviews SET status=$2,decided_by=$3,decided_at=clock_timestamp(),reputation_snapshot=$4 WHERE id=$1',
      [
        review.id,
        action,
        actorId,
        JSON.stringify(await new ReputationRepository().summary(db, event.organization_id)),
      ],
    );
    if (action === 'APPROVED') {
      const sessions = await this.sessions(db, event.id);
      for (const session of sessions) {
        if (!session.pricing_config)
          throw new AppError(422, 'INCOMPLETE_PRICING', 'Thiếu cấu hình giá.');
        if (event.ticketing_mode === 'QUANTITY') {
          for (const price of [...(session.pricing_config as ZonePricingInput['prices'])].sort(
            (a, b) => (BigInt(a.sectionId) < BigInt(b.sectionId) ? -1 : 1),
          ))
            await db.query(
              `INSERT INTO session_seats(session_id,layout_id,section_id,inventory_number,ticket_type_id,price_minor,currency) SELECT $1,$2,$3,n,$4,$5,$6 FROM layout_sections z CROSS JOIN LATERAL generate_series(1,z.capacity) n WHERE z.id=$3 AND z.layout_id=$2`,
              [
                session.id,
                session.layout_id,
                price.sectionId,
                price.ticketTypeId,
                price.priceMinor,
                price.currency,
              ],
            );
          continue;
        }
        for (const price of session.pricing_config as PricingInput['prices'])
          await db.query(
            `INSERT INTO session_seats(session_id,layout_id,seat_id,ticket_type_id,price_minor,currency) VALUES($1,$2,$3,$4,$5,$6)`,
            [
              session.id,
              session.layout_id,
              price.seatId,
              price.ticketTypeId,
              price.priceMinor,
              price.currency,
            ],
          );
      }
      await db.query(
        `UPDATE organizations o SET public_id=$2,avatar_url=COALESCE(u.avatar_url,'/organizer-placeholder.svg'),summary=o.name,category_label='Organizer',profile_created_at=clock_timestamp(),profile_updated_at=clock_timestamp() FROM users u WHERE o.id=$1 AND u.id=o.applicant_user_id AND o.public_id IS NULL`,
        [event.organization_id, 'org-' + randomUUID()],
      );
      await db.query(
        `UPDATE events SET status='PUBLISHED',approved_review_id=$2,approved_event_version=$3,approval_status='APPROVED' WHERE id=$1`,
        [event.id, review.id, review.event_version],
      );
      await db.query(
        `UPDATE events e SET public_id=$2,display_name=$3,publication_cover_image_url=$4,admission_type=ticketing_mode,catalog_status='ON_SALE',starting_price_minor=(SELECT min(ss.price_minor) FROM session_seats ss JOIN event_sessions s ON s.id=ss.session_id WHERE s.event_id=$1),currency='VND',published_at=clock_timestamp(),publication_created_at=clock_timestamp(),publication_updated_at=clock_timestamp() WHERE e.id=$1`,
        [event.id, 'event-' + randomUUID(), event.title, event.cover_image_url],
      );
    } else {
      await db.query('UPDATE events SET status=$2 WHERE id=$1', [
        event.id,
        action === 'WITHDRAWN' ? 'DRAFT' : 'REJECTED',
      ]);
      if (action === 'WITHDRAWN')
        await db.query(`UPDATE seat_layouts SET status='DRAFT',frozen_at=NULL WHERE event_id=$1`, [
          event.id,
        ]);
    }
    if (action === 'REJECTED') {
      const written = await db.query(
        `INSERT INTO reason_notices(review_id,reason_code,reason_text,guidance,status,authored_by,sent_at)
         VALUES($1,$5,$2,$3,'SENT',$4,clock_timestamp())
         ON CONFLICT(review_id) DO UPDATE SET reason_code=EXCLUDED.reason_code,reason_text=EXCLUDED.reason_text,
         guidance=EXCLUDED.guidance,status='SENT',authored_by=EXCLUDED.authored_by,sent_at=EXCLUDED.sent_at,
         version=reason_notices.version+1 WHERE reason_notices.status='DRAFT'`,
        [review.id, reason, guidance, actorId, reasonCode],
      );
      if (!written.rowCount)
        throw new AppError(409, 'NOTICE_STATE_CONFLICT', 'Phiếu đã gửi không được sửa.');
    }
    if (action === 'EXPIRED')
      await db.query('INSERT INTO reason_notices(review_id) VALUES($1) ON CONFLICT DO NOTHING', [
        review.id,
      ]);
    if (action === 'WITHDRAWN') await this.bump(db, event.id);
    if (action !== 'WITHDRAWN')
      await db.query(
        `INSERT INTO notifications(recipient_user_id,type,review_id,payload_redacted) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [
          review.submitted_by,
          'REVIEW_' + action,
          review.id,
          JSON.stringify({
            eventId: event.id,
            title: event.title,
            ...(action === 'REJECTED' ? { reason, guidance } : {}),
          }),
        ],
      );
  }
  async reopen(db: PoolClient, id: string) {
    await db.query(`UPDATE events SET status='DRAFT',version=version+1 WHERE id=$1`, [id]);
    await db.query(`UPDATE seat_layouts SET status='DRAFT',frozen_at=NULL WHERE event_id=$1`, [id]);
  }
  async audit(db: PoolClient, actorId: string, id: string, action: string, requestId: string) {
    await db.query(
      `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id) VALUES('USER',$1,$2,'EVENT',$3,$4)`,
      [actorId, action, id, requestId],
    );
  }
}
