import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AppError } from '../errors/app-error.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}
export async function claimKey(
  db: PoolClient,
  userId: string,
  operation: string,
  key: string,
  request: unknown,
) {
  const actorScope = `user:${userId}`;
  const hash = createHash('sha256').update(canonical(request)).digest();
  const lockId = createHash('sha256')
    .update(canonical([actorScope, operation, key]))
    .digest()
    .readBigInt64BE();
  const lock = await db.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_xact_lock($1::bigint) AS locked',
    [lockId.toString()],
  );
  if (!lock.rows[0]!.locked)
    throw new AppError(
      409,
      'REQUEST_IN_PROGRESS',
      'Yêu cầu đang được xử lý; thử lại với cùng key.',
    );
  await db.query(
    'DELETE FROM idempotency_records WHERE actor_scope=$1 AND operation=$2 AND idempotency_key=$3 AND expires_at<=clock_timestamp()',
    [actorScope, operation, key],
  );
  await db.query(
    `INSERT INTO idempotency_records(actor_scope,operation,idempotency_key,request_hash,expires_at)
    VALUES($1,$2,$3,$4,clock_timestamp()+interval '24 hours') ON CONFLICT DO NOTHING`,
    [actorScope, operation, key, hash],
  );
  const { rows } = await db.query<{
    id: string;
    request_hash: Buffer;
    resource_id: string | null;
    response_code: number | null;
  }>(
    `SELECT id::text,request_hash,resource_id::text,response_code FROM idempotency_records
      WHERE actor_scope=$1 AND operation=$2 AND idempotency_key=$3 FOR UPDATE`,
    [actorScope, operation, key],
  );
  const record = rows[0]!;
  if (!record.request_hash.equals(hash))
    throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Key đã được dùng cho một yêu cầu khác.');
  return record;
}
export async function finishKey(
  db: PoolClient,
  id: string,
  type:
    | 'HOLD'
    | 'RBAC_CHANGE'
    | 'BOOKING'
    | 'PAYMENT'
    | 'TICKET'
    | 'CHECK_IN'
    | 'EVENT'
    | 'ORGANIZATION'
    | 'LAYOUT'
    | 'SESSION'
    | 'TICKET_TYPE'
    | 'REVIEW'
    | 'REASON_NOTICE'
    | 'USER'
    | 'REFUND'
    | 'FEEDBACK'
    | 'SUPPORT_REPORT'
    | 'QUESTIONNAIRE'
    | 'EVENT_CHANGE'
    | 'MEMBERSHIP'
    | 'REPUTATION_ENTRY'
    | 'MERCHANDISE'
    | 'MERCHANDISE_ORDER',
  resourceId: string,
  status: number,
) {
  await db.query(
    'UPDATE idempotency_records SET resource_type=$2,resource_id=$3,response_code=$4 WHERE id=$1',
    [id, type, resourceId, status],
  );
}
export async function purgeExpiredKeys(db: PoolClient) {
  await db.query(`DELETE FROM idempotency_records WHERE id IN (
    SELECT id FROM idempotency_records WHERE expires_at<=clock_timestamp()
    ORDER BY expires_at,id LIMIT 1000 FOR UPDATE SKIP LOCKED)`);
}
