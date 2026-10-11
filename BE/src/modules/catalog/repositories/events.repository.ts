import { withConnection } from '../../../shared/database/pool.js';
import type { CatalogRepository, CatalogRow } from '../types/catalog.repository.types.js';
import type {
  CatalogEvent,
  EventCategory,
  EventChangeRequest,
  EventFilters,
} from '../types/catalog.types.js';
const eventSelect = `
  SELECT ep.public_id AS id, e.title, e.minimum_age AS "minimumAge", CASE WHEN e.minimum_age IS NULL THEN NULL ELSE e.minimum_age::text||'+' END AS "ageTag", ep.display_name AS "displayName",
    c.name AS category, c.slug AS "categorySlug", COALESCE(e.cover_image_url, ep.cover_image_url) AS image,
    to_char(s.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
    to_char(s.starts_at AT TIME ZONE 'UTC', 'Mon FMDD, YYYY · FMHH12:MI AM') AS "dateLabel",
    to_char(s.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "startsAt",
    v.name AS venue, v.city, ep.starting_price_minor AS "startingPrice",
    ep.currency, o.name AS organizer, op.public_id AS "organizerId",
    e.description, lower(ep.admission_type) AS admission,
    lower(replace(ep.catalog_status, '_', '-')) AS status,
    ep.card_badge AS badge, ep.featured_rank IS NOT NULL AS featured,
    ep.spotlight_rank IS NOT NULL AS spotlight, ep.reopening_note AS "reopeningNote"
  FROM events e
  JOIN event_publications ep ON ep.event_id = e.id
  JOIN event_categories c ON c.id = e.category_id
  JOIN organizations o ON o.id = e.organization_id
  JOIN organization_profiles op ON op.organization_id = o.id
  JOIN event_sessions s ON s.id = (
    SELECT s2.id FROM event_sessions s2
    WHERE s2.event_id = e.id AND s2.status = 'SCHEDULED'
    ORDER BY s2.starts_at, s2.id LIMIT 1
  )
  JOIN venues v ON v.id = s.venue_id
`;

function eventParams(filters: EventFilters) {
  const clauses = ["e.status = 'PUBLISHED'", 'ep.published_at <= CURRENT_TIMESTAMP'];
  const params: Array<string | number> = [];
  const parameter = (value: string | number) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.q) {
    const q = `%${filters.q}%`;
    clauses.push(
      `(e.title ILIKE ${parameter(q)} OR o.name ILIKE ${parameter(q)} OR v.name ILIKE ${parameter(q)})`,
    );
  }
  if (filters.category) clauses.push(`c.slug = ${parameter(filters.category)}`);
  if (filters.city) clauses.push(`v.city = ${parameter(filters.city)}`);
  if (filters.featured) clauses.push('ep.featured_rank IS NOT NULL');
  if (filters.spotlight) clauses.push('ep.spotlight_rank IS NOT NULL');

  const limit = parameter(filters.pageSize);
  const offset = parameter((filters.page - 1) * filters.pageSize);
  return { clauses, params, limit, offset };
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
            WHEN e.status = 'PUBLISHED' AND ep.event_id IS NOT NULL AND s.id IS NOT NULL THEN e.id
          END) AS "eventCount"
        FROM event_categories c
        LEFT JOIN events e ON e.category_id = c.id
        LEFT JOIN event_publications ep ON ep.event_id = e.id
          AND ep.published_at <= CURRENT_TIMESTAMP
        LEFT JOIN event_sessions s ON s.event_id = e.id AND s.status = 'SCHEDULED'
        WHERE c.is_active = TRUE
        GROUP BY c.id, c.slug, c.name
        ORDER BY c.id
      `);
      return rows.map((row) => ({ ...row, eventCount: Number(row.eventCount) }));
    });
  },
  async listEvents(filters) {
    const { clauses, params, limit, offset } = eventParams(filters);
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogEvent>>(
        `${eventSelect} WHERE ${clauses.join(' AND ')}
         ORDER BY COALESCE(ep.featured_rank, 9999), s.starts_at, e.id
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      );
      return rows.map(mapEvent);
    });
  },
  async findEvent(id) {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogEvent>>(
        `${eventSelect} WHERE e.status = 'PUBLISHED'
          AND ep.published_at <= CURRENT_TIMESTAMP AND ep.public_id = $1 LIMIT 1`,
        [id],
      );
      return rows[0] ? mapEvent(rows[0]) : null;
    });
  },
  async listChangeRequests() {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<EventChangeRequest>>(`
        SELECT ecr.public_id AS id, ep.public_id AS "eventId", e.title AS "eventTitle",
          o.name AS organizer, COALESCE(e.cover_image_url, ep.cover_image_url) AS image,
          ecr.request_type AS type, ecr.reason, ecr.impact_summary AS "impactSummary",
          ecr.status,
          to_char(ecr.requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "requestedAt"
        FROM event_change_requests ecr
        JOIN events e ON e.id = ecr.event_id
        JOIN event_publications ep ON ep.event_id = e.id
        JOIN organizations o ON o.id = ecr.organization_id
        WHERE ecr.visible_on_catalog = TRUE AND ecr.status = 'APPROVED'
          AND e.status = 'PUBLISHED' AND ep.published_at <= CURRENT_TIMESTAMP
        ORDER BY ecr.requested_at DESC, ecr.id DESC
      `);
      return rows;
    });
  },
};
