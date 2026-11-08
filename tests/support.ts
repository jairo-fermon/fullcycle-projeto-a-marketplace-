import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readConfig } from '../src/config.js';
import { migrate } from '../src/platform/migrate.js';
import { buildApp } from '../src/app.js';
import type { AppOptions } from '../src/app.js';
export async function startTest(options:Partial<AppOptions>={}) {
 if(!process.env.PGDATABASE?.endsWith('_test')||process.env.APP_ENV!=='test')throw new Error('Testes exigem APP_ENV=test e PGDATABASE terminando em _test.');
 const pool=new Pool(readConfig(process.env).database);await migrate(pool);
 await pool.query('TRUNCATE payments.jobs,payments.receipts,payments.attempts; TRUNCATE orders.items,orders.orders; TRUNCATE catalog.products;');
 const system=buildApp(pool,{cacheEnabled:true,cacheTtlMs:50,paymentsEnabled:true,logLevel:'silent',...options});
 const baseUrl=await system.app.listen({host:'127.0.0.1',port:0});
 async function call(method:string,path:string,body?:unknown,headers:Record<string,string>={}){
  const response=await fetch(new URL(path,baseUrl),{method,headers:{'content-type':'application/json',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await response.json();return {response,data};
 }
 async function order(){const product=(await call('POST','/catalog/products',{sku:`TEST-${randomUUID()}`,name:'Produto de teste',category:'geral',unitPriceCents:1500})).data;
  return(await call('POST','/orders',{items:[{productId:product.id,quantity:2}]})).data;}
 return {pool,system,baseUrl,call,order,close:async()=>{await system.app.close();await pool.end();}};
}
export type TestContext=Awaited<ReturnType<typeof startTest>>;
