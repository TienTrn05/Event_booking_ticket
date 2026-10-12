import type { PoolClient } from 'pg';
import type { CatalogEvent } from '../types/catalog.types.js';
import { eventSelect } from '../repositories/events.repository.js';
import type { RecommendationPreferences } from './recommendation.policy.js';
export class RecommendationRepository {
  async preferences(db: PoolClient, userId: string): Promise<RecommendationPreferences> {
    const row = (
      await db.query<{ categories: string[]; city: string | null }>(
        `SELECT favorite_categories AS categories,preferred_city AS city FROM users WHERE id=$1`,
        [userId],
      )
    ).rows[0]!;
    const following = await db.query<{ id: string }>(
      `SELECT o.public_id AS id FROM organization_follows f JOIN organizations o ON o.id=f.organization_id WHERE f.user_id=$1 AND o.status='APPROVED' AND o.public_id IS NOT NULL`,
      [userId],
    );
    return { ...row, organizers: following.rows.map((r) => r.id) };
  }
  async candidates(db: PoolClient) {
    const query = eventSelect.replace(
      "s2.status = 'SCHEDULED'",
      "s2.status = 'SCHEDULED' AND s2.starts_at>clock_timestamp()",
    );
    const rows = await db.query<CatalogEvent>(
      query +
        ` WHERE e.status='PUBLISHED' AND o.status='APPROVED' AND o.public_id IS NOT NULL AND e.published_at<=clock_timestamp() ORDER BY s.starts_at,e.id LIMIT 200`,
    );
    const popularity = await db.query<{ id: string; popularity: number }>(
      `SELECT e.public_id AS id,count(t.id)::int AS popularity FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id JOIN bookings b ON b.id=bi.booking_id JOIN events e ON e.id=b.event_id WHERE e.public_id=ANY($1::text[]) AND b.status='CONFIRMED' AND t.status IN ('VALID','USED') GROUP BY e.public_id`,
      [rows.rows.map((e) => e.id)],
    );
    const byId = new Map(popularity.rows.map((r) => [r.id, r.popularity]));
    return rows.rows.map((e) => ({
      ...e,
      popularity: byId.get(e.id) ?? 0,
      featured: !!e.featured,
      spotlight: !!e.spotlight,
    }));
  }
  async now(db: PoolClient) {
    return (await db.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]!.now;
  }
}
