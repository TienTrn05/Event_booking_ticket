import type { QueryResultRow } from 'pg';
import { withConnection } from '../../shared/database/pool.js';
import type {
  CatalogArticle,
  CatalogEvent,
  CatalogLocation,
  CatalogMerchandise,
  CatalogOrganizer,
  CatalogVenue,
  EventCategory,
  EventChangeRequest,
  EventFilters,
} from './catalog.types.js';

type CatalogRow<T> = T & QueryResultRow;

export interface CatalogRepository {
  listCategories(): Promise<EventCategory[]>;
  listEvents(filters: EventFilters): Promise<CatalogEvent[]>;
  findEvent(id: string): Promise<CatalogEvent | null>;
  listOrganizers(featuredOnly?: boolean): Promise<CatalogOrganizer[]>;
  findOrganizer(id: string): Promise<CatalogOrganizer | null>;
  listMerchandise(): Promise<CatalogMerchandise[]>;
  findMerchandise(id: string): Promise<CatalogMerchandise | null>;
  listArticles(): Promise<CatalogArticle[]>;
  findArticle(id: string): Promise<CatalogArticle | null>;
  listChangeRequests(): Promise<EventChangeRequest[]>;
  listLocations(): Promise<CatalogLocation[]>;
  listVenues(city?: string): Promise<CatalogVenue[]>;
  findVenue(id: string): Promise<CatalogVenue | null>;
}

const eventSelect = `
  SELECT ep.public_id AS id, e.title, ep.display_name AS "displayName",
    c.name AS category, c.slug AS "categorySlug", ep.cover_image_url AS image,
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

const organizerSelect = `
  SELECT op.public_id AS id, o.name, op.avatar_url AS avatar, op.summary,
    o.status = 'APPROVED' AS verified,
    COUNT(DISTINCT CASE WHEN ep.event_id IS NOT NULL THEN e.id END) AS "eventCount",
    COUNT(DISTINCT mp.id) > 0 AS "hasMerchandise", op.category_label AS category,
    (
      SELECT e2.title FROM events e2
      JOIN event_publications ep2 ON ep2.event_id = e2.id
      JOIN event_sessions s2 ON s2.event_id = e2.id AND s2.status = 'SCHEDULED'
      WHERE e2.organization_id = o.id AND e2.status = 'PUBLISHED'
        AND ep2.published_at <= CURRENT_TIMESTAMP AND s2.starts_at >= CURRENT_TIMESTAMP
      ORDER BY s2.starts_at, s2.id LIMIT 1
    ) AS "upcomingEventTitle",
    (
      SELECT to_char(s2.starts_at AT TIME ZONE 'UTC', 'Mon FMDD, YYYY') FROM events e2
      JOIN event_publications ep2 ON ep2.event_id = e2.id
      JOIN event_sessions s2 ON s2.event_id = e2.id AND s2.status = 'SCHEDULED'
      WHERE e2.organization_id = o.id AND e2.status = 'PUBLISHED'
        AND ep2.published_at <= CURRENT_TIMESTAMP AND s2.starts_at >= CURRENT_TIMESTAMP
      ORDER BY s2.starts_at, s2.id LIMIT 1
    ) AS "upcomingEventDate",
    (
      SELECT ep2.public_id FROM events e2
      JOIN event_publications ep2 ON ep2.event_id = e2.id
      JOIN event_sessions s2 ON s2.event_id = e2.id AND s2.status = 'SCHEDULED'
      WHERE e2.organization_id = o.id AND e2.status = 'PUBLISHED'
        AND ep2.published_at <= CURRENT_TIMESTAMP AND s2.starts_at >= CURRENT_TIMESTAMP
      ORDER BY s2.starts_at, s2.id LIMIT 1
    ) AS "upcomingEventId"
  FROM organizations o
  JOIN organization_profiles op ON op.organization_id = o.id
  LEFT JOIN events e ON e.organization_id = o.id AND e.status = 'PUBLISHED'
  LEFT JOIN event_publications ep ON ep.event_id = e.id AND ep.published_at <= CURRENT_TIMESTAMP
  LEFT JOIN merchandise_products mp ON mp.organization_id = o.id AND mp.status = 'PUBLISHED'
`;

export const postgresCatalogRepository: CatalogRepository = {
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

  async listOrganizers(featuredOnly = false) {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogOrganizer>>(
        `${organizerSelect}
         WHERE o.status = 'APPROVED' ${featuredOnly ? 'AND op.featured_rank IS NOT NULL' : ''}
         GROUP BY o.id, op.public_id, o.name, op.avatar_url, op.summary, o.status,
           op.category_label, op.featured_rank
         ORDER BY COALESCE(op.featured_rank, 9999), o.name`,
      );
      return rows.map(mapOrganizer);
    });
  },

  async findOrganizer(id) {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogOrganizer>>(
        `${organizerSelect}
         WHERE o.status = 'APPROVED' AND op.public_id = $1
         GROUP BY o.id, op.public_id, o.name, op.avatar_url, op.summary, o.status,
           op.category_label, op.featured_rank LIMIT 1`,
        [id],
      );
      return rows[0] ? mapOrganizer(rows[0]) : null;
    });
  },

  async listMerchandise() {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogMerchandise>>(`
        SELECT mp.public_id AS id, ep.public_id AS "eventId", e.title AS "eventTitle",
          mp.name, mp.description, mp.image_url AS image, mp.price_minor AS price,
          mp.currency, o.name AS organizer, op.public_id AS "organizerId",
          mp.badge, mp.requires_ticket AS "requiresTicket"
        FROM merchandise_products mp
        JOIN events e ON e.id = mp.event_id
        JOIN event_publications ep ON ep.event_id = e.id
        JOIN organizations o ON o.id = mp.organization_id
        JOIN organization_profiles op ON op.organization_id = o.id
        WHERE mp.status = 'PUBLISHED' AND e.status = 'PUBLISHED'
          AND ep.published_at <= CURRENT_TIMESTAMP
        ORDER BY mp.sort_order, mp.id
      `);
      return rows.map(mapMerchandise);
    });
  },

  async findMerchandise(id) {
    const products = await this.listMerchandise();
    return products.find((product) => product.id === id) ?? null;
  },

  async listArticles() {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<
        CatalogRow<Omit<CatalogArticle, 'paragraphs'> & { bodyJson: unknown }>
      >(`
        SELECT slug AS id, image_url AS image,
          to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "publishedAt",
          to_char(published_at AT TIME ZONE 'UTC', 'Mon FMDD, YYYY') AS date, category,
          read_minutes || ' min read' AS "readTime", title, excerpt, body_json AS "bodyJson"
        FROM blog_articles
        WHERE status = 'PUBLISHED' AND published_at <= CURRENT_TIMESTAMP
        ORDER BY published_at DESC, id DESC
      `);
      return rows.map(mapArticle);
    });
  },

  async findArticle(id) {
    const articles = await this.listArticles();
    return articles.find((article) => article.id === id) ?? null;
  },

  async listChangeRequests() {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<EventChangeRequest>>(`
        SELECT ecr.public_id AS id, ep.public_id AS "eventId", e.title AS "eventTitle",
          o.name AS organizer, ep.cover_image_url AS image,
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

  async listLocations() {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogLocation>>(`
        SELECT cp.display_name AS name, cp.city AS "queryValue",
          COUNT(DISTINCT CASE WHEN ep.event_id IS NOT NULL THEN e.id END) AS "eventCount",
          cp.image_url AS image
        FROM city_profiles cp
        LEFT JOIN venues v ON v.city = cp.city
        LEFT JOIN event_sessions s ON s.venue_id = v.id AND s.status = 'SCHEDULED'
        LEFT JOIN events e ON e.id = s.event_id AND e.status = 'PUBLISHED'
        LEFT JOIN event_publications ep ON ep.event_id = e.id
          AND ep.published_at <= CURRENT_TIMESTAMP
        GROUP BY cp.city, cp.display_name, cp.image_url, cp.sort_order
        ORDER BY cp.sort_order, cp.display_name
      `);
      return rows.map((row) => ({ ...row, eventCount: Number(row.eventCount) }));
    });
  },

  async listVenues(city) {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogVenue>>(
        `SELECT id::text AS id, catalog_code AS code, name, address, city,
          timezone, max_capacity AS "maxCapacity", version
         FROM venues WHERE status = 'ACTIVE' ${city ? 'AND city = $1' : ''}
         ORDER BY city, name LIMIT 100`,
        city ? [city] : [],
      );
      return rows.map(mapVenue);
    });
  },

  async findVenue(id) {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogVenue>>(
        `SELECT id::text AS id, catalog_code AS code, name, address, city,
          timezone, max_capacity AS "maxCapacity", version
         FROM venues WHERE status = 'ACTIVE' AND id = $1 LIMIT 1`,
        [id],
      );
      return rows[0] ? mapVenue(rows[0]) : null;
    });
  },
};

function mapEvent(row: CatalogRow<CatalogEvent>): CatalogEvent {
  return { ...row, featured: Boolean(row.featured), spotlight: Boolean(row.spotlight) };
}

function mapOrganizer(row: CatalogRow<CatalogOrganizer>): CatalogOrganizer {
  return {
    ...row,
    verified: Boolean(row.verified),
    eventCount: Number(row.eventCount),
    hasMerchandise: Boolean(row.hasMerchandise),
  };
}

function mapMerchandise(row: CatalogRow<CatalogMerchandise>): CatalogMerchandise {
  return { ...row, requiresTicket: Boolean(row.requiresTicket) };
}

function mapArticle(
  row: CatalogRow<Omit<CatalogArticle, 'paragraphs'> & { bodyJson: unknown }>,
): CatalogArticle {
  const { bodyJson, ...article } = row;
  const body = typeof bodyJson === 'string' ? JSON.parse(bodyJson) : bodyJson;
  return {
    ...article,
    paragraphs: Array.isArray(body)
      ? body.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function mapVenue(row: CatalogRow<CatalogVenue>): CatalogVenue {
  return { ...row, maxCapacity: Number(row.maxCapacity), version: Number(row.version) };
}
