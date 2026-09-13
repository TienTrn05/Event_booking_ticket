import { checkDatabase, pool } from '../shared/database/pool.js';
try {
  await checkDatabase();
  console.info('MySQL connection OK (read-only SELECT 1; no schema changes).');
} catch {
  console.error(
    'MySQL connection failed. Check the local API .env, service and user grants. Credentials hidden.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
