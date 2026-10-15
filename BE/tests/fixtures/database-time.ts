import { pool } from '../../src/shared/database/pool.js';

/** Keep successful transfer fixtures on the same clock and precision as approval. */
export async function databaseTimestamp(): Promise<string> {
  return (
    await pool.query<{ value: string }>(
      `SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS value`,
    )
  ).rows[0]!.value;
}
