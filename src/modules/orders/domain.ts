import { randomUUID } from 'node:crypto';
import { ensure, AppError } from '../../platform/errors.js';
export interface RequestedItem { productId: string; quantity: number }
export interface PricedItem extends RequestedItem { sku: string; unitPriceCents: number }
export interface Order {
  id: string; status: 'PENDING' | 'PAID'; totalCents: number; createdAt: string; paymentReference: string | null; items: PricedItem[];
}
export type OrderSummary = Omit<Order, 'items'>;
export interface SeedOrder extends Order { origin: 'synthetic_seed' }
export function validateItems(items: RequestedItem[]): void {
  ensure(Array.isArray(items) && items.length >= 1 && items.length <= 100, 'Pedido deve conter de 1 a 100 itens.');
  for (const item of items) ensure(item && typeof item.productId === 'string' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(item.productId)
    && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 1000, 'Item inválido.');
  ensure(new Set(items.map(i => i.productId)).size === items.length, 'Produto duplicado no pedido.');
}
export function newOrder(items: RequestedItem[], prices: { id: string; sku: string; unitPriceCents: number }[]): Order {
  validateItems(items);
  const priced = items.map(item => {
    const product = prices.find(p => p.id === item.productId);
    if (!product) throw new AppError('NOT_FOUND', 'Produto não encontrado.');
    return { ...item, sku: product.sku, unitPriceCents: product.unitPriceCents };
  });
  const totalCents = priced.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  ensure(Number.isSafeInteger(totalCents) && totalCents >= 1 && totalCents <= 100000000000, 'Total inválido.');
  return { id: randomUUID(), status: 'PENDING', totalCents, createdAt: new Date().toISOString(), paymentReference: null, items: priced };
}
export interface OrderRepository {
  create(order: Order): Promise<Order>; get(id: string): Promise<Order | null>;
  list(status: Order['status'], limit: number, page: number): Promise<OrderSummary[]>;
  markPaid(orderId: string, paymentId: string): Promise<void>;
  seed(rows: SeedOrder[]): Promise<void>; seedCount(): Promise<number>;
  optimize(enabled: boolean): Promise<void>; explain(): Promise<unknown>;
}
