import type { Pool } from 'pg';
import type { OrderPaymentPort } from '../orders/index.js';
import { PostgresPayments } from './repository.js';
import { PaymentService } from './service.js';
export type { Payment, Outcome } from './domain.js';
export function createPayments(pool: Pool, orders: OrderPaymentPort, enabled: boolean) {
  const store = new PostgresPayments(pool); const service = new PaymentService(store, orders, enabled);
  return { submit: service.submit.bind(service), get: service.get.bind(service), workOne: service.workOne.bind(service), seed: store.seed.bind(store) };
}
