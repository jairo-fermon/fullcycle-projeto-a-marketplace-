import type { Pool } from 'pg';
import type { Order, OrderRepository, OrderSummary, PricedItem, SeedOrder } from './domain.js';
import { query, transaction } from '../../platform/database.js';
import { AppError } from '../../platform/errors.js';
interface Row { id: string; status: Order['status']; totalCents: string; createdAt: Date; paymentReference: string | null }
const columns = 'id,status,total_cents AS "totalCents",created_at AS "createdAt",payment_reference AS "paymentReference"';
const summary = (row: Row): OrderSummary => ({ ...row, totalCents: Number(row.totalCents), createdAt: row.createdAt.toISOString() });
export class PostgresOrders implements OrderRepository {
  constructor(private pool: Pool) {}
  async create(order: Order): Promise<Order> {
    return transaction(this.pool, async client => {
      await query(client, 'orders.insert', 'INSERT INTO orders.orders(id,status,total_cents,created_at) VALUES($1,$2,$3,$4)', [order.id, order.status, order.totalCents, order.createdAt]);
      for (const [position, item] of order.items.entries()) await query(client, 'orders.insert_item',
        'INSERT INTO orders.items(order_id,position,product_id,sku,quantity,unit_price_cents) VALUES($1,$2,$3,$4,$5,$6)',
        [order.id, position, item.productId, item.sku, item.quantity, item.unitPriceCents]);
      return order;
    });
  }
  async get(id: string): Promise<Order | null> {
    const found = (await query<Row>(this.pool, 'orders.get', `SELECT ${columns} FROM orders.orders WHERE id=$1`, [id])).rows[0];
    if (!found) return null;
    const items = await query<PricedItem>(this.pool, 'orders.get_items', 'SELECT product_id AS "productId",sku,quantity,unit_price_cents AS "unitPriceCents" FROM orders.items WHERE order_id=$1 ORDER BY position', [id]);
    return { ...summary(found), items: items.rows };
  }
  async list(status: Order['status'], limit: number, page: number): Promise<OrderSummary[]> {
    return (await query<Row>(this.pool, 'orders.list', `SELECT ${columns} FROM orders.orders WHERE status=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,
      [status, limit, (page - 1) * limit])).rows.map(summary);
  }
  async markPaid(orderId: string, paymentId: string): Promise<void> {
    const changed = await query(this.pool, 'orders.mark_paid', "UPDATE orders.orders SET status='PAID',payment_reference=$2 WHERE id=$1 AND (status='PENDING' OR payment_reference=$2) RETURNING id", [orderId, paymentId]);
    if (changed.rowCount) return;
    if (!(await this.get(orderId))) throw new AppError('NOT_FOUND', 'Pedido não encontrado.');
    throw new AppError('CONFLICT', 'Pedido já pago por outra tentativa.');
  }
  async seed(rows: SeedOrder[]): Promise<void> {
    await transaction(this.pool, async client => {
      await query(client, 'orders.seed', `INSERT INTO orders.orders(id,status,total_cents,created_at,payment_reference,origin)
        SELECT id,status,"totalCents","createdAt","paymentReference",origin FROM jsonb_to_recordset($1::jsonb)
        AS x(id uuid,status text,"totalCents" bigint,"createdAt" timestamptz,"paymentReference" uuid,origin text) ON CONFLICT(id) DO NOTHING`, [JSON.stringify(rows)]);
      const items = rows.flatMap(row => row.items.map((item, position) => ({ orderId: row.id, position, ...item })));
      await query(client, 'orders.seed_items', `INSERT INTO orders.items(order_id,position,product_id,sku,quantity,unit_price_cents)
        SELECT "orderId",position,"productId",sku,quantity,"unitPriceCents" FROM jsonb_to_recordset($1::jsonb)
        AS x("orderId" uuid,position int,"productId" uuid,sku text,quantity int,"unitPriceCents" int) ON CONFLICT(order_id,position) DO NOTHING`, [JSON.stringify(items)]);
    });
  }
  async seedCount(): Promise<number> { return Number((await query(this.pool, 'orders.count_seed', "SELECT count(*) AS count FROM orders.orders WHERE origin='synthetic_seed'")).rows[0]!.count); }
  async optimize(enabled: boolean): Promise<void> {
    await query(this.pool, 'orders.optimize', enabled ? 'CREATE INDEX IF NOT EXISTS orders_status_created_id_idx ON orders.orders(status,created_at DESC,id DESC)' : 'DROP INDEX IF EXISTS orders.orders_status_created_id_idx');
    await query(this.pool, 'orders.analyze', 'ANALYZE orders.orders');
  }
  async explain(): Promise<unknown> {
    return (await query(this.pool, 'orders.explain', "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,status,total_cents,created_at FROM orders.orders WHERE status='PENDING' ORDER BY created_at DESC,id DESC LIMIT 20")).rows[0];
  }
}
