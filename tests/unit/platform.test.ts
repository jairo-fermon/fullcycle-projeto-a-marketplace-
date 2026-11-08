import { describe, expect, it } from 'vitest';
import { readConfig } from '../../src/config.js';
import { seedProducts,seedBatch,syntheticId } from '../../src/platform/seed-plan.js';
import { traced,carrier } from '../../src/platform/telemetry.js';
const env={PGHOST:'test-db',PGDATABASE:'marketplace_test',PGUSER:'tests',PGPASSWORD:'fixture-local-de-teste'};
describe('Configuração, plano sintético e traces',()=>{
 it('configura desenvolvimento e produção com variáveis externas',()=>{
  expect(readConfig(env)).toMatchObject({environment:'development',port:3001,cacheEnabled:true,paymentsEnabled:true});
  expect(readConfig({...env,APP_ENV:'production',CATALOG_CACHE_ENABLED:'false',PAYMENT_PROCESSING_ENABLED:'false',PORT:'3002',HOST:'127.0.0.1',LOG_LEVEL:'silent'})).toMatchObject({environment:'production',cacheEnabled:false,paymentsEnabled:false,port:3002});
 });
 it.each([{...env,PGPASSWORD:''},{...env,APP_ENV:'wrong'},{...env,PORT:'0'},{...env,PGPORT:'65536'},{...env,CACHE_TTL_MS:'1.5'},{...env,CATALOG_CACHE_ENABLED:'yes'},{...env,LOG_LEVEL:'wrong'}])('recusa configuração inválida %#',input=>expect(()=>readConfig(input)).toThrow());
 it('seed tem IDs estáveis, lotes e pagamentos coerentes',()=>{
  const products=seedProducts(10),batch=seedBatch(1,10,products);expect(batch.orders).toHaveLength(10);expect(batch.payments).toHaveLength(2);expect(batch.orders[4]!.paymentReference).toBe(batch.payments[0]!.id);expect(batch.orders[4]!.totalCents).toBe(batch.payments[0]!.amountCents);
  expect(seedBatch(1,10,products)).toEqual(batch);expect(syntheticId(1,1)).toMatch(/^[\da-f-]{36}$/);
  expect(()=>seedProducts(0)).toThrow();expect(()=>seedProducts(5001)).toThrow();expect(()=>seedBatch(0,1,products)).toThrow();expect(()=>seedBatch(100000,2,products)).toThrow();expect(()=>seedBatch(1,1,[])).toThrow();
 });
 it('trace preserva retorno e erro de negócio, sem exigir SDK no teste unitário',async()=>{
  expect(await traced('unit',async()=>42)).toBe(42);expect(carrier()).toBeTypeOf('object');const error=new Error('teste');await expect(traced('unit-error',async()=>{throw error;})).rejects.toBe(error);
 });
});
