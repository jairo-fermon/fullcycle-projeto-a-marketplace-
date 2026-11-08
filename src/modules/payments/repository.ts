import type { Pool } from 'pg';
import type { Payment } from './domain.js';
import type { TraceCarrier } from '../../platform/telemetry.js';
import { traced } from '../../platform/telemetry.js';
import { query, transaction } from '../../platform/database.js';
import { AppError } from '../../platform/errors.js';
interface Row extends Omit<Payment, 'createdAt' | 'processedAt' | 'amountCents'> { createdAt: Date; processedAt: Date | null; amountCents: string }
const columns = 'a.id,a.order_id AS "orderId",a.idempotency_key AS "idempotencyKey",a.amount_cents AS "amountCents",a.outcome,a.status,a.created_at AS "createdAt",a.processed_at AS "processedAt",COALESCE(j.deliveries,0) AS deliveries';
const convert = (row: Row): Payment => ({ ...row, amountCents: Number(row.amountCents), createdAt: row.createdAt.toISOString(), processedAt: row.processedAt?.toISOString() ?? null });
export class PostgresPayments {
  constructor(private pool: Pool) {}
  async find(id: string, byKey = false): Promise<Payment | null> {
    const found = (await query<Row>(this.pool, 'payments.get', `SELECT ${columns} FROM payments.attempts a LEFT JOIN payments.jobs j ON j.id=a.id WHERE ${byKey ? 'a.idempotency_key' : 'a.id'}=$1`, [id])).rows[0];
    return found ? convert(found) : null;
  }
  async enqueue(payment: Payment, carrier: TraceCarrier): Promise<Payment> {
    return transaction(this.pool, async client => {
      const added = await query(client, 'payments.enqueue', `INSERT INTO payments.attempts(id,order_id,idempotency_key,amount_cents,outcome,status,created_at)
        VALUES($1,$2,$3,$4,$5,'QUEUED',$6) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,
        [payment.id, payment.orderId, payment.idempotencyKey, payment.amountCents, payment.outcome, payment.createdAt]);
      if (!added.rowCount) {
        const existing = await this.find(payment.idempotencyKey, true);
        if (!existing) throw new Error('Tentativa concorrente não encontrada.');
        return existing;
      }
      await query(client, 'payments.enqueue_job', 'INSERT INTO payments.jobs(id,trace_context) VALUES($1,$2::jsonb)', [payment.id, JSON.stringify(carrier)]);
      return payment;
    });
  }
  async workOne(process: (payment: Payment) => Promise<'SUCCEEDED' | 'DECLINED'>): Promise<'idle' | 'done' | 'duplicate' | 'retry' | 'dead'> {
    return transaction(this.pool, async client => {
      const job = (await query<{ id: string; deliveries: number; trace_context: TraceCarrier }>(client, 'payments.claim',
        "SELECT id,deliveries,trace_context FROM payments.jobs WHERE state='READY' AND available_at<=clock_timestamp() ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];
      if (!job) return 'idle';
      return traced('payments.process_job', async () => {
        const receipt = await query(client, 'payments.receipt_lookup', 'SELECT payment_id FROM payments.receipts WHERE payment_id=$1', [job.id]);
        if (receipt.rowCount) { await query(client, 'payments.duplicate', "UPDATE payments.jobs SET state='DONE' WHERE id=$1", [job.id]); return 'duplicate' as const; }
        const payment = await this.find(job.id);
        if (!payment) throw new Error('Pagamento da fila ausente.');
        const deliveries = job.deliveries + 1;
        await client.query('SAVEPOINT delivery');
        try {
          const status = await process(payment);
          await query(client, 'payments.receipt', 'INSERT INTO payments.receipts(payment_id,processed_at) VALUES($1,clock_timestamp()) ON CONFLICT DO NOTHING', [job.id]);
          await query(client, 'payments.complete', 'UPDATE payments.attempts SET status=$2,processed_at=clock_timestamp() WHERE id=$1', [job.id, status]);
          await query(client, 'payments.complete_job', "UPDATE payments.jobs SET state='DONE',deliveries=$2,last_error_code=NULL WHERE id=$1", [job.id, deliveries]);
          return 'done' as const;
        } catch (error) {
          await client.query('ROLLBACK TO SAVEPOINT delivery');
          const permanent = error instanceof AppError && ['NOT_FOUND', 'CONFLICT', 'INVALID_INPUT'].includes(error.code);
          const dead = permanent || deliveries >= 3;
          const code = error instanceof AppError ? error.code : 'PROCESSING_ERROR';
          await query(client, 'payments.retry', "UPDATE payments.jobs SET state=$2,deliveries=$3,last_error_code=$4,available_at=clock_timestamp()+($5*interval '1 millisecond') WHERE id=$1",
            [job.id, dead ? 'DEAD' : 'READY', deliveries, code, Math.min(1000 * 2 ** (deliveries - 1), 30000)]);
          if (dead) await query(client, 'payments.failed', "UPDATE payments.attempts SET status='FAILED',processed_at=clock_timestamp() WHERE id=$1", [job.id]);
          return dead ? 'dead' as const : 'retry' as const;
        }
      }, job.trace_context);
    });
  }
  async seed(payments: Payment[]): Promise<void> {
    await transaction(this.pool, async client => {
      await query(client, 'payments.seed', `INSERT INTO payments.attempts(id,order_id,idempotency_key,amount_cents,outcome,status,created_at,processed_at,origin)
        SELECT id,"orderId","idempotencyKey","amountCents",outcome,status,"createdAt","processedAt",'synthetic_seed' FROM jsonb_to_recordset($1::jsonb)
        AS x(id uuid,"orderId" uuid,"idempotencyKey" uuid,"amountCents" bigint,outcome text,status text,"createdAt" timestamptz,"processedAt" timestamptz) ON CONFLICT(id) DO NOTHING`, [JSON.stringify(payments)]);
      await query(client, 'payments.seed_receipts', `INSERT INTO payments.receipts(payment_id,processed_at)
        SELECT id,"processedAt" FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,"processedAt" timestamptz) ON CONFLICT(payment_id) DO NOTHING`, [JSON.stringify(payments)]);
    });
  }
}
