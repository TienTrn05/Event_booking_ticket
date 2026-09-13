import type { PoolConnection } from 'mysql2/promise';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connection = vi.hoisted(() => ({
  query: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('../src/shared/database/pool.js', () => ({
  withConnection: (work: (value: PoolConnection) => Promise<unknown>) =>
    work(connection as unknown as PoolConnection),
}));
import { withTransaction } from '../src/shared/database/transaction.js';

beforeEach(() => {
  vi.resetAllMocks();
  connection.query.mockResolvedValue([]);
  connection.beginTransaction.mockResolvedValue(undefined);
  connection.commit.mockResolvedValue(undefined);
  connection.rollback.mockResolvedValue(undefined);
});

describe('transaction failure semantics', () => {
  it('commits work performed on the same connection', async () => {
    const result = await withTransaction(async (value) => {
      expect(value).toBe(connection);
      return 'completed';
    });
    expect(result).toBe('completed');
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  it('rolls back business failures and never commits them', async () => {
    const failure = new Error('business failure');
    await expect(
      withTransaction(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('discards a connection after rollback failure without hiding the original error', async () => {
    const failure = new Error('original failure');
    connection.rollback.mockRejectedValue(new Error('rollback unavailable'));
    await expect(
      withTransaction(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(connection.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not replay work when COMMIT has an ambiguous outcome', async () => {
    const failure = new Error('connection lost during commit');
    connection.commit.mockRejectedValue(failure);
    const work = vi.fn().mockResolvedValue('value');
    await expect(withTransaction(work)).rejects.toBe(failure);
    expect(work).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });
});
