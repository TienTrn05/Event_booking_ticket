import { withConnection } from '../../../shared/database/pool.js';
import type { CatalogRepository, CatalogRow } from '../types/catalog.repository.types.js';
import type {
  CatalogEvent,
  EventCategory,
  EventChangeRequest,
  EventFilters,
} from '../types/catalog.types.js';
export const eventSelect = `
  SELECT e.public_id AS id, e.title, e.minimum_age AS "minimumAge", CASE WHEN e.minimum_age IS NULL THEN NULL ELSE e.minimum_age::text||'+' END AS "ageTag", e.display_name AS "displayName",
    c.name AS category, c.slug AS "categorySlug", COALESCE(e.cover_image_url, e.publication_cover_image_url) AS image,
    to_char(s.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
    to_char(s.starts_at AT TIME ZONE 'UTC', 'Mon FMDD, YYYY · FMHH12:MI AM') AS "dateLabel",
    to_char(s.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "startsAt",
    v.name AS venue, v.city, COALESCE((SELECT min(ss.price_minor) FROM session_seats ss WHERE ss.session_id=s.id),e.starting_price_minor)::text AS "startingPrice",
    e.currency, o.name AS organizer, o.public_id AS "organizerId",
    e.description, lower(e.admission_type) AS admission,
    lower(replace(e.catalog_status, '_', '-')) AS status,
    e.card_badge AS badge, e.featured_rank IS NOT NULL AS featured,
    e.spotlight_rank IS NOT NULL AS spotlight, e.reopening_note AS "reopeningNote"
  FROM events e
  JOIN event_categories c ON c.id = e.category_id
  JOIN organizations o ON o.id = e.organization_id
  JOIN event_sessions s ON s.id = (
    SELECT s2.id FROM event_sessions s2
    WHERE s2.event_id = e.id AND s2.status = 'SCHEDULED' AND s2.ends_at>CURRENT_TIMESTAMP
    ORDER BY s2.starts_at, s2.id LIMIT 1
  )
  JOIN venues v ON v.id = s.venue_id
`;

export function eventParams(filters: EventFilters) {
  const clauses = [
    "e.status = 'PUBLISHED'",
    "o.status='APPROVED'",
    'o.public_id IS NOT NULL',
    'e.published_at <= CURRENT_TIMESTAMP',
  ];
  const params: Array<string | number> = [];
  const parameter = (value: string | number) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (filters.excludedForUserId)
    clauses.push(
      `NOT EXISTS(SELECT 1 FROM organization_blocks ob WHERE ob.organization_id=e.organization_id AND ob.user_id=${parameter(filters.excludedForUserId)}::bigint)`,
    );

  if (filters.q) {
    const q = `%${filters.q}%`;
    clauses.push(
      `(e.title ILIKE ${parameter(q)} OR o.name ILIKE ${parameter(q)} OR v.name ILIKE ${parameter(q)})`,
    );
  }
  if (filters.category) clauses.push(`c.slug = ${parameter(filters.category)}`);
  if (filters.featured !== undefined)
    clauses.push(`e.featured_rank IS ${filters.featured ? 'NOT ' : ''}NULL`);
  if (filters.spotlight !== undefined)
    clauses.push(`e.spotlight_rank IS ${filters.spotlight ? 'NOT ' : ''}NULL`);
  const sessionClauses: string[] = [];
  if (filters.city)
    sessionClauses.push(
      `EXISTS(SELECT 1 FROM venues fv WHERE fv.id=s2.venue_id AND fv.city=${parameter(filters.city)})`,
    );
  if (filters.from) sessionClauses.push(`s2.starts_at>=${parameter(filters.from)}::timestamptz`);
  if (filters.to) sessionClauses.push(`s2.starts_at<${parameter(filters.to)}::timestamptz`);
  const activeSeat =
    '(ss.section_id IS NOT NULL OR EXISTS(SELECT 1 FROM seats physical WHERE physical.id=ss.seat_id AND physical.is_active))';
  const seatClauses = ['ss.session_id=s2.id', activeSeat];
  if (filters.minPrice !== undefined)
    seatClauses.push(`ss.price_minor>=${parameter(filters.minPrice)}::bigint`);
  if (filters.maxPrice !== undefined)
    seatClauses.push(`ss.price_minor<=${parameter(filters.maxPrice)}::bigint`);
  const available = `(ss.status='AVAILABLE' OR (ss.status='HELD' AND ss.hold_expires_at<=CURRENT_TIMESTAMP))`;
  if (filters.available === true) seatClauses.push(available);
  if (
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.available === true
  )
    sessionClauses.push(
      `EXISTS(SELECT 1 FROM session_seats ss WHERE ${seatClauses.join(' AND ')})`,
    );
  if (filters.available === false)
    sessionClauses.push(
      `NOT EXISTS(SELECT 1 FROM session_seats ss WHERE ss.session_id=s2.id AND ${activeSeat} AND ${available})`,
    );
  const basePrice =
    'COALESCE((SELECT min(ss.price_minor) FROM session_seats ss WHERE ss.session_id=s.id),e.starting_price_minor)';
  const matchingPrice = `COALESCE((SELECT min(ss.price_minor) FROM session_seats ss WHERE ${seatClauses.join(' AND ').replace('s2.id', 's.id')}),e.starting_price_minor)`;
  const select = eventSelect
    .replace(basePrice, matchingPrice)
    .replace(
      'AND s2.ends_at>CURRENT_TIMESTAMP',
      `AND s2.ends_at>CURRENT_TIMESTAMP ${sessionClauses.length ? 'AND ' + sessionClauses.join(' AND ') : ''}`,
    );
  const sort = {
    recommended: 'COALESCE(e.featured_rank,9999),s.starts_at,e.id',
    date_asc: 's.starts_at,e.id',
    date_desc: 's.starts_at DESC,e.id DESC',
    price_asc: matchingPrice + ',e.id',
    price_desc: matchingPrice + ' DESC,e.id DESC',
  }[filters.sort ?? 'recommended'];

  const limit = parameter(filters.pageSize);
  const offset = parameter((filters.page - 1) * filters.pageSize);
  return { clauses, params, limit, offset, select, sort };
}

function mapEvent(row: CatalogRow<CatalogEvent>): CatalogEvent {
  return { ...row, featured: Boolean(row.featured), spotlight: Boolean(row.spotlight) };
}
export const eventsRepository: Pick<
  CatalogRepository,
  'listCategories' | 'listEvents' | 'findEvent' | 'listChangeRequests'
> = {
  async listCategories() {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<EventCategory>>(`
        SELECT c.slug AS id, c.name,
          COUNT(DISTINCT CASE
            WHEN e.status = 'PUBLISHED' AND e.public_id IS NOT NULL AND e.published_at <= CURRENT_TIMESTAMP AND s.id IS NOT NULL THEN e.id
          END) AS "eventCount"
        FROM event_categories c
        LEFT JOIN events e ON e.category_id = c.id
        LEFT JOIN event_sessions s ON s.event_id = e.id AND s.status = 'SCHEDULED'
        WHERE c.is_active = TRUE
        GROUP BY c.id, c.slug, c.name
        ORDER BY c.id
      `);
      return rows.map((row) => ({ ...row, eventCount: Number(row.eventCount) }));
    });
  },
  async listEvents(filters) {
    const { clauses, params, limit, offset, select, sort } = eventParams(filters);
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogEvent>>(
        `${select} WHERE ${clauses.join(' AND ')}
         ORDER BY ${sort}
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      );
      return rows.map(mapEvent);
    });
  },
  async findEvent(id, userId) {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogEvent>>(
        `${eventSelect} WHERE e.status = 'PUBLISHED' AND o.status='APPROVED' AND o.public_id IS NOT NULL
          AND e.published_at <= CURRENT_TIMESTAMP AND e.public_id = $1
          AND NOT EXISTS(SELECT 1 FROM organization_blocks ob WHERE ob.organization_id=e.organization_id AND ob.user_id=$2::bigint) LIMIT 1`,
        [id, userId ?? null],
      );
      return rows[0] ? mapEvent(rows[0]) : null;
    });
  },
  async listChangeRequests(userId) {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<EventChangeRequest>>(
        `
        SELECT ecr.public_id AS id, e.public_id AS "eventId", e.title AS "eventTitle",
          o.name AS organizer, COALESCE(e.cover_image_url, e.publication_cover_image_url) AS image,
          ecr.request_type AS type, ecr.reason, ecr.impact_summary AS "impactSummary",
          ecr.status,
          to_char(ecr.requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "requestedAt"
        FROM event_change_requests ecr
        JOIN events e ON e.id = ecr.event_id
        JOIN organizations o ON o.id = ecr.organization_id
        WHERE ecr.visible_on_catalog = TRUE AND ecr.status = 'APPROVED'
          AND e.status = 'PUBLISHED' AND e.published_at <= CURRENT_TIMESTAMP
          AND NOT EXISTS(SELECT 1 FROM organization_blocks ob WHERE ob.organization_id=e.organization_id AND ob.user_id=$1::bigint)
        ORDER BY ecr.requested_at DESC, ecr.id DESC
      `,
        [userId ?? null],
      );
      return rows;
    });
  },
};
