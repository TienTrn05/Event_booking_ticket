import { withConnection } from '../../../shared/database/pool.js';
import type { CatalogRepository, CatalogRow } from '../types/catalog.repository.types.js';
import type { CatalogLocation, CatalogVenue } from '../types/catalog.types.js';
function mapVenue(row: CatalogRow<CatalogVenue>): CatalogVenue {
  return { ...row, maxCapacity: Number(row.maxCapacity), version: Number(row.version) };
}
export const venuesRepository: Pick<
  CatalogRepository,
  'listLocations' | 'listVenues' | 'findVenue'
> = {
  async listLocations() {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogLocation>>(`
        SELECT cp.display_name AS name, cp.city AS "queryValue",
          COUNT(DISTINCT CASE WHEN e.public_id IS NOT NULL AND e.published_at <= CURRENT_TIMESTAMP THEN e.id END) AS "eventCount",
          cp.image_url AS image
        FROM city_profiles cp
        LEFT JOIN venues v ON v.city = cp.city
        LEFT JOIN event_sessions s ON s.venue_id = v.id AND s.status = 'SCHEDULED'
        LEFT JOIN events e ON e.id = s.event_id AND e.status = 'PUBLISHED'
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
