import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { SpanKind, trace } from '@opentelemetry/api';
import { traced } from './telemetry.js';
export async function query<R extends QueryResultRow = QueryResultRow>(client: Pool | PoolClient, operation: string, sql: string, values: unknown[] = []): Promise<QueryResult<R>> {
  return traced(`postgres.${operation}`, async () => {
    trace.getActiveSpan()?.setAttribute('db.system.name', 'postgresql');
    return client.query<R>(sql, values);
  }, undefined, SpanKind.CLIENT);
}
export async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
