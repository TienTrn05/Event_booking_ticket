import type { PoolClient } from 'pg';
import { discardConnection, withConnection } from './pool.js';

// All repositories in work must receive this exact connection.
// No automatic retry: idempotency and ambiguous COMMIT recovery belong to the service.
export function withTransaction<T>(work: (connection: PoolClient) => Promise<T>): Promise<T> {
  return withConnection(async (connection) => {
    await connection.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    try {
      const result = await work(connection);
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await connection.query('ROLLBACK');
      } catch {
        discardConnection(connection);
      }
      throw error;
    }
  });
}
