import { beforeEach,afterEach,describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { parse } from 'yaml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { Plugin } from 'ajv';
import type { FormatOptions,FormatName } from 'ajv-formats';
import { startTest } from '../support.js';
import type { TestContext } from '../support.js';
type Schema=Record<string,unknown>;
const spec=parse(await readFile(new URL('../../docs/openapi.yaml',import.meta.url),'utf8'))as {components:{schemas:Record<string,Schema>};paths:Record<string,Record<string,{responses:Record<string,{content?:{'application/json':{schema:Schema}}}>}>>};
const ajv=new Ajv2020({strict:false});const formats=createRequire(import.meta.url)('ajv-formats')as Plugin<FormatOptions|FormatName[]>;formats(ajv);
function validate(path:string,method:string,status:number,data:unknown){const response=spec.paths[path]?.[method]?.responses[String(status)];expect(response,`Resposta ${method} ${path} ${status} documentada`).toBeDefined();
 const schema=response?.content?.['application/json'].schema;expect(schema).toBeDefined();const fn=ajv.compile({...schema,components:spec.components});expect(fn(data),JSON.stringify(fn.errors)).toBe(true);return fn;}
let t:TestContext;beforeEach(async()=>{t=await startTest();});afterEach(async()=>{await t?.close();});
describe('Contrato: schemas OpenAPI 3.1 versus respostas HTTP reais',()=>{
 it('valida catálogo, pedidos, pagamento e prova que schema rejeita resposta incompatível',async()=>{
  const p=await t.call('POST','/catalog/products',{sku:'CONTRACT',name:'Contrato',category:'geral',unitPriceCents:101});validate('/catalog/products','post',p.response.status,p.data);
  const products=await t.call('GET','/catalog/products?category=geral');validate('/catalog/products','get',products.response.status,products.data);
  const order=await t.call('POST','/orders',{items:[{productId:p.data.id,quantity:3}]});const check=validate('/orders','post',order.response.status,order.data);expect(order.data.totalCents).toBe(303);expect(check({...order.data,totalCents:'303'})).toBe(false);
  const list=await t.call('GET','/orders');validate('/orders','get',list.response.status,list.data);const found=await t.call('GET',`/orders/${order.data.id}`);validate('/orders/{id}','get',found.response.status,found.data);
  const key=randomUUID(),input={orderId:order.data.id,outcome:'approve'};const payment=await t.call('POST','/payments',input,{'idempotency-key':key});validate('/payments','post',payment.response.status,payment.data);
  const duplicate=await t.call('POST','/payments',input,{'idempotency-key':key});validate('/payments','post',duplicate.response.status,duplicate.data);
  await t.system.workOnce();const paid=await t.call('GET',`/payments/${payment.data.id}`);validate('/payments/{id}','get',paid.response.status,paid.data);expect(paid.data.status).toBe('SUCCEEDED');
  const final=await t.call('GET',`/orders/${order.data.id}`);validate('/orders/{id}','get',final.response.status,final.data);expect(final.data.status).toBe('PAID');
 });
 it('valida respostas de erro e health e rejeita coerção de entrada',async()=>{
  const invalid=await t.call('POST','/catalog/products',{sku:'X',name:'X',category:'geral',unitPriceCents:'100'});expect(invalid.response.status).toBe(400);validate('/catalog/products','post',400,invalid.data);
  const missing=await t.call('GET',`/orders/${randomUUID()}`);validate('/orders/{id}','get',404,missing.data);
  const health=await t.call('GET','/health');validate('/health','get',200,health.data);
 });
});
