import type { QueryResultRow } from 'pg';

/** The read/lock SQL used by existing auth guards on a caller-owned connection. */
export interface SqlReader {
  query<R extends QueryResultRow = QueryResultRow>(
    statement: string,
    values?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}
