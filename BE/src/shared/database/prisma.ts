import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { QueryResultRow } from 'pg';
import { pool } from './pool.js';
import { env } from '../../config/env.js';
import type { SqlReader } from './sql-reader.js';

let client: PrismaClient | undefined;

function getClient() {
  // Reuse the existing pool and its budget. Prisma does not own pool shutdown.
  return (client ??= new PrismaClient({
    adapter: new PrismaPg(pool, { disposeExternalPool: false }),
  }));
}

export function withPrismaTransaction<T>(
  work: (db: Prisma.TransactionClient, sql: SqlReader) => Promise<T>,
): Promise<T> {
  return getClient().$transaction(
    async (db) => {
      await db.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
      await db.$queryRaw`SELECT set_config('lock_timeout', ${`${env.DB_LOCK_TIMEOUT_SECONDS}s`}, true)`;
      const sql: SqlReader = {
        async query<R extends QueryResultRow>(statement: string, values: unknown[] = []) {
          // Statements come from internal repositories; values remain PG bind parameters.
          // Never use the root client or pg pool inside this transaction callback.
          const rows = await db.$queryRawUnsafe<R[]>(statement, ...values);
          return { rows, rowCount: rows.length };
        },
      };
      return work(db, sql);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5000,
      timeout: (env.DB_LOCK_TIMEOUT_SECONDS + 5) * 1000,
    },
  );
}

export async function closePrisma(): Promise<void> {
  const current = client;
  client = undefined;
  await current?.$disconnect();
}
