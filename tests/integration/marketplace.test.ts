import { beforeEach,afterEach,describe,it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startTest } from '../support.js';
import type { TestContext } from '../support.js';
import { createPayments } from '../../src/modules/payments/index.js';
import { PostgresOrders } from '../../src/modules/orders/repository.js';
import { seedProducts,seedBatch } from '../../src/platform/seed-plan.js';
import { AppError } from '../../src/platform/errors.js';
import { migrate } from '../../src/platform/migrate.js';
let t:TestContext;
beforeEach(async()=>{t=await startTest();});afterEach(async()=>{await t?.close();});
describe('Monólito modular, HTTP e banco reais',()=>{
 it('fluxo completo e preços vindos do catálogo, com pagamento assíncrono',async()=>{
  const order=await t.order();expect(order.totalCents).toBe(3000);expect(order.status).toBe('PENDING');
  const queued=await t.call('POST','/payments',{orderId:order.id,outcome:'approve'},{'idempotency-key':randomUUID()});expect(queued.response.status).toBe(202);expect(queued.data.status).toBe('QUEUED');
  expect((await t.pool.query('SELECT count(*) FROM payments.jobs')).rows[0].count).toBe('1');expect(await t.system.workOnce()).toBe('done');
  expect((await t.call('GET',`/payments/${queued.data.id}`)).data).toMatchObject({status:'SUCCEEDED',deliveries:1,amountCents:3000});
  expect((await t.call('GET',`/orders/${order.id}`)).data).toMatchObject({status:'PAID',paymentReference:queued.data.id});
  expect((await t.pool.query('SELECT total_cents,status FROM orders.orders WHERE id=$1',[order.id])).rows).toEqual([{total_cents:'3000',status:'PAID'}]);
  expect(await t.system.workOnce()).toBe('idle');
 });
 it('8 solicitações concorrentes com mesma chave geram uma tentativa e um job',async()=>{
  const order=await t.order(),key=randomUUID(),body={orderId:order.id,outcome:'approve'};
  const responses=await Promise.all(Array.from({length:8},()=>t.call('POST','/payments',body,{'idempotency-key':key})));
  expect(responses.filter(r=>r.response.status===202)).toHaveLength(1);expect(responses.every(r=>[200,202].includes(r.response.status))).toBe(true);expect(new Set(responses.map(r=>r.data.id)).size).toBe(1);
  expect((await t.pool.query('SELECT count(*) FROM payments.attempts')).rows[0].count).toBe('1');expect((await t.pool.query('SELECT count(*) FROM payments.jobs')).rows[0].count).toBe('1');
  const conflict=await t.call('POST','/payments',{...body,outcome:'decline'},{'idempotency-key':key});expect(conflict.response.status).toBe(409);
 });
 it('recibo persistido reconhece entrega duplicada sem repetir efeito',async()=>{
  const order=await t.order(),key=randomUUID();const payment=(await t.call('POST','/payments',{orderId:order.id,outcome:'approve'},{'idempotency-key':key})).data;
  await t.system.workOnce();await t.pool.query("UPDATE payments.jobs SET state='READY' WHERE id=$1",[payment.id]);expect(await t.system.workOnce()).toBe('duplicate');
  expect((await t.pool.query('SELECT count(*) FROM payments.receipts')).rows[0].count).toBe('1');
  const replay=await t.call('POST','/payments',{orderId:order.id,outcome:'approve'},{'idempotency-key':key});expect(replay.response.status).toBe(200);expect(replay.data.status).toBe('SUCCEEDED');
  expect((await t.system.orders.get(order.id)).paymentReference).toBe(payment.id);
 });
 it('recupera falha após efeito no pedido, antes de gravar recibo',async()=>{
  const order=await t.order();let fail=true;
  const payments=createPayments(t.pool,{paymentSnapshot:t.system.orders.paymentSnapshot,markPaid:async(id,paymentId)=>{await t.system.orders.markPaid(id,paymentId);if(fail){fail=false;throw new Error('Falha de teste após efeito.');}}},true);
  const queued=await payments.submit(order.id,'approve',randomUUID());expect(await payments.workOne()).toBe('retry');
  expect((await t.system.orders.get(order.id)).status).toBe('PAID');expect((await payments.get(queued.payment.id)).status).toBe('QUEUED');
  await t.pool.query("UPDATE payments.jobs SET available_at=clock_timestamp() WHERE id=$1",[queued.payment.id]);expect(await payments.workOne()).toBe('done');
  expect((await payments.get(queued.payment.id))).toMatchObject({status:'SUCCEEDED',deliveries:2});expect((await t.pool.query('SELECT count(*) FROM payments.receipts')).rows[0].count).toBe('1');
 });
 it('limita falha transitória a três entregas e armazena código seguro',async()=>{
  const order=await t.order();const payments=createPayments(t.pool,{paymentSnapshot:t.system.orders.paymentSnapshot,markPaid:async()=>{throw new Error('SEGREDO-NAO-REGISTRAR');}},true);
  const payment=(await payments.submit(order.id,'approve',randomUUID())).payment;
  for(let attempt=1;attempt<=3;attempt++){await t.pool.query('UPDATE payments.jobs SET available_at=clock_timestamp() WHERE id=$1',[payment.id]);expect(await payments.workOne()).toBe(attempt===3?'dead':'retry');}
  const stored=(await t.pool.query('SELECT state,deliveries,last_error_code FROM payments.jobs WHERE id=$1',[payment.id])).rows[0];expect(stored).toEqual({state:'DEAD',deliveries:3,last_error_code:'PROCESSING_ERROR'});
  expect((await payments.get(payment.id)).status).toBe('FAILED');expect((await t.system.orders.get(order.id)).status).toBe('PENDING');expect(await payments.workOne()).toBe('idle');
 });
 it('erro permanente encerra a tentativa e recusa simulada mantém pedido pendente',async()=>{
  const order=await t.order();const failed=createPayments(t.pool,{paymentSnapshot:t.system.orders.paymentSnapshot,markPaid:async()=>{throw new AppError('CONFLICT','Concorrência definitiva.');}},true);
  await failed.submit(order.id,'approve',randomUUID());expect(await failed.workOne()).toBe('dead');
  const declined=await t.system.payments.submit(order.id,'decline',randomUUID());expect(await t.system.workOnce()).toBe('done');expect((await t.system.payments.get(declined.payment.id)).status).toBe('DECLINED');expect((await t.system.orders.get(order.id)).status).toBe('PENDING');
 });
 it('processadores concorrentes não obtêm o mesmo job',async()=>{
  const order=await t.order();await t.system.payments.submit(order.id,'approve',randomUUID());
  expect((await Promise.all([t.system.workOnce(),t.system.workOnce()])).sort()).toEqual(['done','idle']);expect((await t.pool.query('SELECT count(*) FROM payments.receipts')).rows[0].count).toBe('1');
 });
 it('retoma fila com nova instância da aplicação e consulta dados persistidos',async()=>{
  const order=await t.order();const queued=await t.system.payments.submit(order.id,'approve',randomUUID());
  const fresh=createPayments(t.pool,t.system.orders,true);expect(await fresh.workOne()).toBe('done');expect((await fresh.get(queued.payment.id)).status).toBe('SUCCEEDED');
  const newPayment=await t.call('POST','/payments',{orderId:order.id,outcome:'approve'},{'idempotency-key':randomUUID()});expect(newPayment.response.status).toBe(409);
 });
 it('precificação ignora cache de catálogo desatualizado e escrita invalida listagem',async()=>{
  const p=await t.system.catalog.create({sku:'P',name:'P',category:'geral',unitPriceCents:100});expect((await t.system.catalog.list('geral',20)).cache).toBe('miss');expect((await t.system.catalog.list('geral',20)).cache).toBe('hit');
  await t.pool.query('UPDATE catalog.products SET unit_price_cents=200 WHERE id=$1',[p.id]);const order=await t.system.orders.create([{productId:p.id,quantity:2}]);expect(order.totalCents).toBe(400);
  await t.system.catalog.create({sku:'P2',name:'P2',category:'geral',unitPriceCents:100});expect((await t.system.catalog.list('geral',20)).items).toHaveLength(2);
 });
 it('seed em lotes é idempotente, coerente e tem origem sintética',async()=>{
  const products=seedProducts(10),batch=seedBatch(1,50,products);
  for(let i=0;i<2;i++){await t.system.catalog.seed(products);await t.system.orders.seed(batch.orders);await t.system.payments.seed(batch.payments);}
  expect(await t.system.orders.seedCount()).toBe(50);expect((await t.pool.query('SELECT count(*) FROM payments.attempts')).rows[0].count).toBe('10');
  const wrong=await t.pool.query("SELECT count(*) FROM orders.orders o JOIN orders.items i ON i.order_id=o.id LEFT JOIN catalog.products p ON p.id=i.product_id LEFT JOIN payments.attempts a ON a.id=o.payment_reference WHERE p.id IS NULL OR o.total_cents<>i.quantity*i.unit_price_cents OR (o.status='PAID' AND (a.id IS NULL OR a.status<>'SUCCEEDED' OR a.amount_cents<>o.total_cents))");expect(wrong.rows[0].count).toBe('0');
  expect((await t.system.orders.list('PENDING',20,1))).toHaveLength(20);expect((await t.system.orders.list('PENDING',20,2))).toHaveLength(20);
  await t.system.orders.optimize(false);expect(await t.system.orders.explain()).toBeTypeOf('object');await t.system.orders.optimize(true);
 });
 it('rollback real impede pedido parcial quando o banco rejeita item',async()=>{
  const product=await t.system.catalog.create({sku:'ROLLBACK',name:'Rollback',category:'geral',unitPriceCents:100});
  const malformed={id:randomUUID(),status:'PENDING' as const,totalCents:100,createdAt:new Date().toISOString(),paymentReference:null,items:[{productId:product.id,sku:product.sku,quantity:0,unitPriceCents:100}]};
  const repository=new PostgresOrders(t.pool);await expect(repository.create(malformed)).rejects.toMatchObject({code:'23514'});expect(await repository.get(malformed.id)).toBeNull();
 });
 it('migrations repetem sem apagar e detectam alteração de checksum',async()=>{
  await migrate(t.pool);const old=(await t.pool.query('SELECT sha256 FROM schema_migrations WHERE name=$1',['001-marketplace.sql'])).rows[0].sha256;
  try{await t.pool.query('UPDATE schema_migrations SET sha256=$1 WHERE name=$2',['alterado','001-marketplace.sql']);await expect(migrate(t.pool)).rejects.toThrow('Migration aplicada');}
  finally{await t.pool.query('UPDATE schema_migrations SET sha256=$1 WHERE name=$2',[old,'001-marketplace.sql']);}
  await expect(migrate(t.pool)).resolves.toBeUndefined();
 });
 it('erros de domínio, SKU duplicado, UUID e limite de corpo são determinísticos',async()=>{
  const input={sku:'UNIQUE',name:'Produto',category:'geral',unitPriceCents:100};expect((await t.call('POST','/catalog/products',input)).response.status).toBe(201);expect((await t.call('POST','/catalog/products',input)).response.status).toBe(409);
  expect((await t.call('POST','/catalog/products',{...input,sku:'X',name:' '})).response.status).toBe(400);
  expect((await t.call('GET','/orders/invalido')).response.status).toBe(400);expect((await t.call('GET',`/orders/${randomUUID()}`)).response.status).toBe(404);expect((await t.call('GET',`/payments/${randomUUID()}`)).response.status).toBe(404);
  expect((await t.call('POST','/orders',{items:[{productId:randomUUID(),quantity:1}]})).response.status).toBe(404);
  expect((await t.call('POST','/payments',{orderId:randomUUID(),outcome:'approve'})).response.status).toBe(400);
  expect((await t.call('POST','/catalog/products',{...input,name:'X'.repeat(70000)})).response.status).toBe(413);
  expect((await t.call('GET','/orders?limit=0')).response.status).toBe(400);expect((await t.call('GET','/catalog/products?limit=51')).response.status).toBe(400);
  expect((await t.call('GET','/unknown')).response.status).toBe(404);
 });
 it('métricas RED mudam com tráfego real sem ID como label',async()=>{
  const order=await t.order();const before=await(await fetch(`${t.baseUrl}/metrics`)).text();await t.call('GET',`/orders/${order.id}`);await t.call('GET',`/orders/${randomUUID()}`);
  const after=await(await fetch(`${t.baseUrl}/metrics`)).text();expect(after).not.toBe(before);expect(after).toContain('http_errors_total{method="GET",route="/orders/:id",status="404"} 1');expect(after).toContain('http_request_duration_seconds_bucket');expect(after).not.toContain(order.id);expect((await t.call('GET','/health')).data).toEqual({status:'ok'});
 });
});
