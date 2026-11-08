import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PaymentService } from '../../src/modules/payments/service.js';
import type { PaymentStore } from '../../src/modules/payments/service.js';
import { strategy } from '../../src/modules/payments/domain.js';
import type { Payment } from '../../src/modules/payments/domain.js';
function fixture(enabled=true){
 const orderId=randomUUID(),key=randomUUID();const payment:Payment={id:randomUUID(),orderId,idempotencyKey:key,amountCents:3000,outcome:'approve',status:'QUEUED',createdAt:new Date().toISOString(),processedAt:null,deliveries:0};
 const store:PaymentStore={find:vi.fn(async()=>null),enqueue:vi.fn(async p=>p),workOne:vi.fn(async process=>{await process(payment);return'done' as const;})};
 const orders={paymentSnapshot:vi.fn(async()=>({id:orderId,status:'PENDING' as 'PENDING'|'PAID',totalCents:3000})),markPaid:vi.fn(async()=>{})};
 return{orderId,key,payment,store,orders,service:new PaymentService(store,orders,enabled)};
}
describe('Pagamentos: Strategy, flag e idempotência',()=>{
 it('estratégias resolvem simulação determinística',()=>{expect(strategy('approve').resolve()).toBe('SUCCEEDED');expect(strategy('decline').resolve()).toBe('DECLINED');expect(()=>strategy('invalid' as never)).toThrow();});
 it('registra com valor do pedido e processa por interface pública',async()=>{
  const f=fixture();const result=await f.service.submit(f.orderId,'approve',f.key);expect(result.replayed).toBe(false);expect(result.payment.amountCents).toBe(3000);expect(f.store.enqueue).toHaveBeenCalled();
  expect(await f.service.workOne()).toBe('done');expect(f.orders.markPaid).toHaveBeenCalledWith(f.orderId,f.payment.id);
 });
 it('repetição não cria novo job e payload diferente conflita',async()=>{
  const f=fixture();vi.mocked(f.store.find).mockResolvedValue(f.payment);expect((await f.service.submit(f.orderId,'approve',f.key)).replayed).toBe(true);expect(f.store.enqueue).not.toHaveBeenCalled();
  await expect(f.service.submit(f.orderId,'decline',f.key)).rejects.toMatchObject({code:'CONFLICT'});
  await expect(f.service.submit(randomUUID(),'approve',f.key)).rejects.toMatchObject({code:'CONFLICT'});
  expect(await f.service.get(f.payment.id)).toBe(f.payment);vi.mocked(f.store.find).mockResolvedValue(null);await expect(f.service.get(f.payment.id)).rejects.toMatchObject({code:'NOT_FOUND'});
 });
 it('conflito concorrente é revalidado após enqueue atômico',async()=>{
  const f=fixture();vi.mocked(f.store.enqueue).mockResolvedValue(f.payment);expect((await f.service.submit(f.orderId,'approve',f.key)).replayed).toBe(true);
  vi.mocked(f.store.enqueue).mockResolvedValue({...f.payment,outcome:'decline'});await expect(f.service.submit(f.orderId,'approve',f.key)).rejects.toMatchObject({code:'CONFLICT'});
 });
 it('recusa pedido já pago e suspende admissão/worker com flag',async()=>{
  const f=fixture();vi.mocked(f.orders.paymentSnapshot).mockResolvedValue({id:f.orderId,status:'PAID',totalCents:3000});await expect(f.service.submit(f.orderId,'approve',f.key)).rejects.toMatchObject({code:'CONFLICT'});
  const paused=fixture(false);await expect(paused.service.submit(paused.orderId,'approve',paused.key)).rejects.toMatchObject({code:'UNAVAILABLE'});expect(await paused.service.workOne()).toBe('paused');expect(paused.store.enqueue).not.toHaveBeenCalled();
 });
 it('recusa simulada não modifica pedido',async()=>{
  const f=fixture();f.payment.outcome='decline';expect(await f.service.workOne()).toBe('done');expect(f.orders.markPaid).not.toHaveBeenCalled();
 });
});
