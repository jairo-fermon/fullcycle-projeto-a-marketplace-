import { ensure } from '../../platform/errors.js';
export type Outcome = 'approve' | 'decline';
export interface Payment {
  id: string; orderId: string; idempotencyKey: string; amountCents: number; outcome: Outcome;
  status: 'QUEUED' | 'SUCCEEDED' | 'DECLINED' | 'FAILED'; createdAt: string; processedAt: string | null; deliveries: number;
}
export interface PaymentStrategy { resolve(): 'SUCCEEDED' | 'DECLINED' }
class Approve implements PaymentStrategy { resolve() { return 'SUCCEEDED' as const; } }
class Decline implements PaymentStrategy { resolve() { return 'DECLINED' as const; } }
export function strategy(outcome: Outcome): PaymentStrategy {
  ensure(outcome === 'approve' || outcome === 'decline', 'Resultado simulado inválido.');
  return outcome === 'approve' ? new Approve() : new Decline();
}
export function sameRequest(payment: Payment, orderId: string, outcome: Outcome): boolean { return payment.orderId === orderId && payment.outcome === outcome; }
