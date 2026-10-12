import type { PoolClient, QueryResultRow } from 'pg';
import { Pool } from 'pg';
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
      'organizations',
      'events',
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
    const catalogColumns = await connection.query<{ count: string }>(
      `SELECT count(*)::text FROM information_schema.columns WHERE table_schema=current_schema()
       AND ((table_name='organizations' AND column_name IN ('public_id','profile_created_at','profile_updated_at'))
        OR (table_name='events' AND column_name IN ('public_id','publication_cover_image_url','published_at')))`,
    );
    if (catalogColumns.rows[0]?.count !== '6')
      throw new Error('Catalog consolidation migration 011 is required.');
    const operationsColumns = await connection.query<{ count: string }>(
      `SELECT count(*)::text FROM information_schema.columns WHERE table_schema=current_schema()
       AND ((table_name='refunds' AND column_name IN ('version','evidence_note','approved_at'))
        OR (table_name='feedback' AND column_name IN ('kind','author_id','history')))`,
    );
    if (operationsColumns.rows[0]?.count !== '6')
      throw new Error('Refund and feedback migration 012 is required.');
    if (env.PAYOS_CLIENT_ID) {
      const paymentColumns = await connection.query<{ count: string }>(
        `SELECT count(*)::text FROM information_schema.columns WHERE table_schema=current_schema()
         AND table_name='payments' AND column_name=ANY($1::text[])`,
        [['checkout_url', 'received_minor', 'last_polled_at']],
      );
      if (paymentColumns.rows[0]?.count !== '3')
        throw new Error('Payment migration 007 is required.');
    }
  });
}
