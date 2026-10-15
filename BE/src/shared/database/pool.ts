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

    const requiredTables = [
      'organizations',
      'events',
      'city_profiles',
      'merchandise_products',
      'merchandise_skus',
      'merchandise_orders',
      'merchandise_order_items',
      'organization_reputation_entries',
      'blog_articles',
      'event_change_requests',
      'users',
      'roles',
      'permissions',
      'user_roles',
      'role_permissions',
      'external_identities',
      'phone_login_aliases',
      'auth_sessions',
      'refresh_tokens',
      'otp_challenges',
      'organization_memberships',
      'event_categories',
      'venues',
      'seat_layouts',
      'layout_sections',
      'layout_rows',
      'seats',
      'event_sessions',
      'ticket_types',
      'reservation_quotas',
      'seat_holds',
      'bookings',
      'session_seats',
      'seat_hold_items',
      'booking_items',
      'payments',
      'tickets',
      'check_ins',
      'support_reports',
      'refunds',
      'event_reviews',
      'reason_notices',
      'notifications',
      'idempotency_records',
      'payment_webhooks',
      'outbox_messages',
      'audit_logs',
      'organization_follows',
      'organization_blocks',
      'onboarding_questionnaires',
      'feedback',
    ] as const;
    const { rows } = await connection.query<TableCountRow>(
      `SELECT COUNT(*)::text AS table_count
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = ANY($1::text[])`,
      [[...requiredTables]],
    );

    if (Number(rows[0]?.table_count ?? 0) !== requiredTables.length) {
      throw new Error('Application database schema is not installed.');
    }
    if (
      !(
        await connection.query<{ installed: boolean }>(
          "SELECT to_regprocedure('backend_v1_extensions_installed()') IS NOT NULL AS installed",
        )
      ).rows[0]?.installed
    )
      throw new Error('Backend v1 migration017 is required.');
    if (
      !(
        await connection.query<{ installed: boolean }>(
          "SELECT to_regprocedure('dynamic_rbac_installed()') IS NOT NULL AS installed",
        )
      ).rows[0]?.installed
    )
      throw new Error('Dynamic RBAC migration018 is required.');
    const searchTrigger = await connection.query<{ installed: boolean }>(
      "SELECT to_regprocedure('enqueue_search_event(bigint)') IS NOT NULL AS installed",
    );
    if (!searchTrigger.rows[0]?.installed)
      throw new Error('Event search outbox migration015 is required.');
    if (
      !(
        await connection.query<{ installed: boolean }>(
          "SELECT to_regprocedure('validate_zone_inventory()') IS NOT NULL AS installed",
        )
      ).rows[0]?.installed
    )
      throw new Error('Outdoor inventory migration016 is required.');
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
    const coreColumns = await connection.query<{
      count: string;
    }>(`SELECT count(*)::text FROM information_schema.columns WHERE table_schema=current_schema() AND
      ((table_name='users' AND column_name IN ('onboarding_completed_at','onboarding_questionnaire_id','onboarding_answers')) OR
      (table_name='event_sessions' AND column_name='pricing_config') OR
      (table_name='onboarding_questionnaires' AND column_name IN ('questions','status')) OR
      (table_name='events' AND column_name IN ('cancelled_by','cancelled_at','cancellation_reason','minimum_age')) OR
      (table_name='event_change_requests' AND column_name IN ('event_version','snapshot_json','decision_reason','version')) OR
      (table_name='notifications' AND column_name='event_version') OR
      (table_name='booking_items' AND column_name IN ('cccd_ciphertext','identity_verified_at','cccd_purge_after')) OR
      (table_name='tickets' AND column_name IN ('ticket_code_ciphertext','ticket_code_hash')))`);
    if (coreColumns.rows[0]?.count !== '20')
      throw new Error('Commerce, onboarding and operations migrations are required.');
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
