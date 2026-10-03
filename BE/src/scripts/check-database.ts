import { checkDatabase, pool } from '../shared/database/pool.js';
try {
  await checkDatabase();
  console.info(
    'PostgreSQL connection and catalog schema OK (read-only checks; no schema changes).',
  );
} catch {
  console.error(
    'PostgreSQL is unavailable or catalog migration is missing. Check .env, grants and database/migrations/001-public-catalog.sql. Credentials hidden.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
