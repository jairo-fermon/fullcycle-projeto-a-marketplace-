import type { Product } from '../modules/catalog/index.js';
import type { SeedOrder } from '../modules/orders/index.js';
import type { Payment } from '../modules/payments/index.js';
import { ensure } from './errors.js';
export function syntheticId(prefix: number, index: number): string { return `${prefix.toString(16).padStart(8, '0')}-0000-4000-8000-${index.toString().padStart(12, '0')}`; }
export function seedProducts(count: number): Product[] {
  ensure(Number.isInteger(count) && count >= 1 && count <= 5000, 'Quantidade de produtos sintéticos inválida.');
  return Array.from({ length: count }, (_, i) => ({ id: syntheticId(1, i + 1), sku: `SEED-${String(i + 1).padStart(5, '0')}`, name: `Produto ${String(i + 1).padStart(5, '0')}`, category: `category-${String(i % 50).padStart(2, '0')}`, unitPriceCents: 100 + i * 3, createdAt: '2026-01-01T00:00:00.000Z' }));
}
export function seedBatch(start: number, count: number, products: Product[]) {
  ensure(Number.isInteger(start) && Number.isInteger(count) && start >= 1 && count >= 1 && start + count - 1 <= 100000 && products.length > 0, 'Lote sintético inválido.');
  const orders: SeedOrder[] = []; const payments: Payment[] = [];
  for (let index = start; index < start + count; index++) {
    const product = products[(index - 1) % products.length]!;
    const quantity = 1 + index % 3; const paid = index % 5 === 0;
    const id = syntheticId(2, index), paymentId = syntheticId(3, index);
    const createdAt = new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString();
    const totalCents = quantity * product.unitPriceCents;
    orders.push({ id, status: paid ? 'PAID' : 'PENDING', totalCents, createdAt, paymentReference: paid ? paymentId : null, origin: 'synthetic_seed', items: [{ productId: product.id, sku: product.sku, quantity, unitPriceCents: product.unitPriceCents }] });
    if (paid) payments.push({ id: paymentId, orderId: id, idempotencyKey: syntheticId(4, index), amountCents: totalCents, outcome: 'approve', status: 'SUCCEEDED', createdAt, processedAt: createdAt, deliveries: 0 });
  }
  return { orders, payments };
}
