import { checkDatabase, pool } from '../shared/database/pool.js';
try {
  await checkDatabase();
  console.info(
    'PostgreSQL connection and application schema OK (read-only checks; no schema changes).',
  );
} catch (error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  const message =
    code === '28P01'
      ? 'PostgreSQL rejected DB_USER/DB_PASSWORD (SQLSTATE 28P01). Check BE/.env against the PostgreSQL role password.'
      : code === '3D000'
        ? 'PostgreSQL database DB_NAME does not exist (SQLSTATE 3D000).'
        : code === '42501'
          ? 'PostgreSQL role lacks permission to inspect the database schema (SQLSTATE 42501).'
          : code === 'ECONNREFUSED'
            ? 'PostgreSQL refused the connection. Check DB_HOST, DB_PORT and that the server is running.'
            : 'PostgreSQL connection or application schema check failed. Check BE/.env, grants and database/README.md.';
  console.error(message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
