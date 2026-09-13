import type { PoolConnection } from 'mysql2/promise';
import { withConnection } from './pool.js';
// All repositories in work must receive this exact connection.
// No automatic retry: idempotency and ambiguous COMMIT recovery belong to the service.
export function withTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  return withConnection(async (connection) => {
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    try {
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        connection.destroy();
      }
      throw error;
    }
  });
}
