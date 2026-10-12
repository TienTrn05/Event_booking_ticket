import { withConnection } from '../../../shared/database/pool.js';
import type { CatalogRepository, CatalogRow } from '../types/catalog.repository.types.js';
import type { CatalogArticle, CatalogMerchandise } from '../types/catalog.types.js';
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
export const contentRepository: Pick<
  CatalogRepository,
  'listMerchandise' | 'findMerchandise' | 'listArticles' | 'findArticle'
> = {
  async listMerchandise() {
    return withConnection(async (connection) => {
      const { rows } = await connection.query<CatalogRow<CatalogMerchandise>>(`
        SELECT mp.public_id AS id, e.public_id AS "eventId", e.title AS "eventTitle",
          mp.name, mp.description, mp.image_url AS image, mp.price_minor AS price,
          mp.currency, o.name AS organizer, o.public_id AS "organizerId",
          mp.badge, mp.requires_ticket AS "requiresTicket"
        FROM merchandise_products mp
        JOIN events e ON e.id = mp.event_id
        JOIN organizations o ON o.id = mp.organization_id
        WHERE mp.status = 'PUBLISHED' AND e.status = 'PUBLISHED'
          AND e.published_at <= CURRENT_TIMESTAMP
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
};
