import { withConnection } from '../../../shared/database/pool.js';
import type { CatalogRepository, CatalogRow } from '../types/catalog.repository.types.js';
import type { CatalogOrganizer } from '../types/catalog.types.js';
const organizerSelect = `
  SELECT o.public_id AS id, o.name, o.avatar_url AS avatar, o.summary,
    o.status = 'APPROVED' AND o.public_id IS NOT NULL AS verified,
    COUNT(DISTINCT CASE WHEN e.public_id IS NOT NULL AND e.published_at <= CURRENT_TIMESTAMP THEN e.id END) AS "eventCount",
    COUNT(DISTINCT mp.id) > 0 AS "hasMerchandise", o.category_label AS category,
    (
      SELECT e2.title FROM events e2
      JOIN event_sessions s2 ON s2.event_id = e2.id AND s2.status = 'SCHEDULED'
      WHERE e2.organization_id = o.id AND e2.status = 'PUBLISHED'
        AND e2.published_at <= CURRENT_TIMESTAMP AND s2.starts_at >= CURRENT_TIMESTAMP
      ORDER BY s2.starts_at, s2.id LIMIT 1
    ) AS "upcomingEventTitle",
    (
      SELECT to_char(s2.starts_at AT TIME ZONE 'UTC', 'Mon FMDD, YYYY') FROM events e2
      JOIN event_sessions s2 ON s2.event_id = e2.id AND s2.status = 'SCHEDULED'
      WHERE e2.organization_id = o.id AND e2.status = 'PUBLISHED'
        AND e2.published_at <= CURRENT_TIMESTAMP AND s2.starts_at >= CURRENT_TIMESTAMP
      ORDER BY s2.starts_at, s2.id LIMIT 1
    ) AS "upcomingEventDate",
    (
      SELECT e2.public_id FROM events e2
      JOIN event_sessions s2 ON s2.event_id = e2.id AND s2.status = 'SCHEDULED'
      WHERE e2.organization_id = o.id AND e2.status = 'PUBLISHED'
        AND e2.published_at <= CURRENT_TIMESTAMP AND s2.starts_at >= CURRENT_TIMESTAMP
      ORDER BY s2.starts_at, s2.id LIMIT 1
    ) AS "upcomingEventId"
  FROM organizations o
  LEFT JOIN events e ON e.organization_id = o.id AND e.status = 'PUBLISHED'
  LEFT JOIN merchandise_products mp ON mp.organization_id = o.id AND mp.status = 'PUBLISHED'
`;

function mapOrganizer(row: CatalogRow<CatalogOrganizer>): CatalogOrganizer {
  return {
    ...row,
    verified: Boolean(row.verified),
    eventCount: Number(row.eventCount),
    hasMerchandise: Boolean(row.hasMerchandise),
  };
}
export const organizersRepository: Pick<CatalogRepository, 'listOrganizers' | 'findOrganizer'> = {
  async listOrganizers(featuredOnly = false) {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogOrganizer>>(
        `${organizerSelect}
         WHERE o.status = 'APPROVED' AND o.public_id IS NOT NULL ${featuredOnly ? 'AND o.featured_rank IS NOT NULL' : ''}
         GROUP BY o.id, o.public_id, o.name, o.avatar_url, o.summary, o.status,
           o.category_label, o.featured_rank
         ORDER BY COALESCE(o.featured_rank, 9999), o.name`,
      );
      return rows.map(mapOrganizer);
    });
  },
  async findOrganizer(id) {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogOrganizer>>(
        `${organizerSelect}
         WHERE o.status = 'APPROVED' AND o.public_id IS NOT NULL AND o.public_id = $1
         GROUP BY o.id, o.public_id, o.name, o.avatar_url, o.summary, o.status,
           o.category_label, o.featured_rank LIMIT 1`,
        [id],
      );
      return rows[0] ? mapOrganizer(rows[0]) : null;
    });
  },
};
