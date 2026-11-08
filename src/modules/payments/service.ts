import { randomUUID } from 'node:crypto';
import type { OrderPaymentPort } from '../orders/index.js';
import type { Payment, Outcome } from './domain.js';
import { sameRequest, strategy } from './domain.js';
import type { PostgresPayments } from './repository.js';
import { AppError } from '../../platform/errors.js';
import { carrier, traced } from '../../platform/telemetry.js';
export type PaymentStore = Pick<PostgresPayments, 'find' | 'enqueue' | 'workOne'>;
export class PaymentService {
  constructor(private store: PaymentStore, private orders: OrderPaymentPort, private enabled: boolean) {}
  async submit(orderId: string, outcome: Outcome, key: string): Promise<{ payment: Payment; replayed: boolean }> {
    if (!this.enabled) throw new AppError('UNAVAILABLE', 'Processamento de pagamentos desabilitado pela feature flag.');
    strategy(outcome); // Seleção determinística e validada antes de gravar.
    return traced('payments.submit', async () => {
      const existing = await this.store.find(key, true);
      if (existing) {
        if (!sameRequest(existing, orderId, outcome)) throw new AppError('CONFLICT', 'Chave de idempotência usada com outra solicitação.');
        return { payment: existing, replayed: true };
      }
      const order = await this.orders.paymentSnapshot(orderId);
      if (order.status !== 'PENDING') throw new AppError('CONFLICT', 'Pedido já pago.');
      const candidate: Payment = { id: randomUUID(), orderId, idempotencyKey: key, amountCents: order.totalCents, outcome, status: 'QUEUED', createdAt: new Date().toISOString(), processedAt: null, deliveries: 0 };
      const payment = await this.store.enqueue(candidate, carrier());
      if (!sameRequest(payment, orderId, outcome)) throw new AppError('CONFLICT', 'Chave de idempotência usada com outra solicitação.');
      return { payment, replayed: payment.id !== candidate.id };
    });
  }
  async get(id: string): Promise<Payment> { const payment = await this.store.find(id); if (!payment) throw new AppError('NOT_FOUND', 'Pagamento não encontrado.'); return payment; }
  async workOne() {
    if (!this.enabled) return 'paused' as const;
    return this.store.workOne(async payment => {
      const result = strategy(payment.outcome).resolve();
      if (result === 'SUCCEEDED') await this.orders.markPaid(payment.orderId, payment.id);
      return result;
    });
  }
}
