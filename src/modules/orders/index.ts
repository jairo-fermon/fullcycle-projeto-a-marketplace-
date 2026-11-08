import type { Pool } from 'pg';
import type { CatalogPort } from '../catalog/index.js';
import { PostgresOrders } from './repository.js';
import { OrderService } from './service.js';
export type { Order, OrderSummary, SeedOrder, RequestedItem } from './domain.js';
export interface OrderPaymentPort {
  paymentSnapshot(id: string): Promise<{ id: string; status: 'PENDING' | 'PAID'; totalCents: number }>;
  markPaid(id: string, paymentId: string): Promise<void>;
}
export function createOrders(pool: Pool, catalog: CatalogPort) {
  const repository = new PostgresOrders(pool); const service = new OrderService(repository, catalog);
  return { create: service.create.bind(service), get: service.get.bind(service), list: service.list.bind(service),
    paymentSnapshot: service.paymentSnapshot.bind(service), markPaid: service.markPaid.bind(service),
    seed: repository.seed.bind(repository), seedCount: repository.seedCount.bind(repository),
    optimize: repository.optimize.bind(repository), explain: repository.explain.bind(repository) };
}
