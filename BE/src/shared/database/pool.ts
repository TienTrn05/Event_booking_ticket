import { Pool } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import { env } from '../../config/env.js';

const discardedConnections = new WeakSet<PoolClient>();

export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  max: env.DATABASE_POOL_MAX,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
});

export function discardConnection(connection: PoolClient): void {
  discardedConnections.add(connection);
}

export async function withConnection<T>(work: (connection: PoolClient) => Promise<T>): Promise<T> {
  const connection = await pool.connect();
  try {
    await connection.query("SET TIME ZONE 'UTC'");
    await connection.query("SELECT set_config('lock_timeout', $1, false)", [
      `${env.DB_LOCK_TIMEOUT_SECONDS}s`,
    ]);
    return await work(connection);
  } finally {
    const discard = discardedConnections.has(connection);
    discardedConnections.delete(connection);
    connection.release(discard);
  }
}

interface TableCountRow extends QueryResultRow {
  table_count: string;
}

export async function checkDatabase(): Promise<void> {
  await withConnection(async (connection) => {
    await connection.query('SELECT 1');

    const requiredCatalogTables = [
      'organization_profiles',
      'event_publications',
      'city_profiles',
      'merchandise_products',
      'blog_articles',
      'event_change_requests',
    ] as const;
    const { rows } = await connection.query<TableCountRow>(
      `SELECT COUNT(*)::text AS table_count
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = ANY($1::text[])`,
      [[...requiredCatalogTables]],
    );

    if (Number(rows[0]?.table_count ?? 0) !== requiredCatalogTables.length) {
      throw new Error('Database catalog schema is not installed.');
    }
  });
}
