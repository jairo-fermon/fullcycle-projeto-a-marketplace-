import { describe,it,expect,vi } from 'vitest';
import { Pool } from 'pg';
import { Writable } from 'node:stream';
import { buildApp } from '../../src/app.js';
describe('HTTP: falhas seguras e feature flag',()=>{
 it('oculta SQL/credenciais, registra JSON e verifica health indisponível',async()=>{
  const pool=new Pool();vi.spyOn(pool,'query').mockRejectedValue(new Error('SQL password=SEGREDO-NAO-EXIBIR'));
  const lines:string[]=[];const stream=new Writable({write(chunk,_enc,callback){lines.push(String(chunk));callback();}});
  const s=buildApp(pool,{cacheEnabled:false,cacheTtlMs:50,paymentsEnabled:true,logStream:stream});
  try{
   const failed=await s.app.inject({method:'POST',url:'/catalog/products',headers:{authorization:'Bearer SEGREDO-HEADER'},payload:{sku:'SENSITIVE-SKU',name:'Teste',category:'geral',unitPriceCents:100}});
   expect(failed.statusCode).toBe(500);expect(failed.json()).toMatchObject({error:{code:'INTERNAL_ERROR',requestId:failed.headers['x-request-id']}});
   expect((await s.app.inject('/health')).statusCode).toBe(503);
   for(const secret of ['SEGREDO-NAO-EXIBIR','SEGREDO-HEADER','SENSITIVE-SKU'])expect(lines.join('')).not.toContain(secret);
   const logs=lines.flatMap(l=>l.trim().split('\n')).map(l=>JSON.parse(l)as Record<string,unknown>);expect(logs.some(l=>l.msg==='request_completed'&&typeof l.durationMs==='number'&&l.route==='/catalog/products')).toBe(true);
  }finally{await s.app.close();await pool.end();}
 });
 it('flag desabilitada retorna 503 e worker fica pausado',async()=>{
  const pool=new Pool();const s=buildApp(pool,{cacheEnabled:true,cacheTtlMs:50,paymentsEnabled:false,logLevel:'silent'});
  try{const r=await s.app.inject({method:'POST',url:'/payments',headers:{'idempotency-key':'00000004-0000-4000-8000-000000000001'},payload:{orderId:'00000002-0000-4000-8000-000000000001',outcome:'approve'}});expect(r.statusCode).toBe(503);expect(await s.workOnce()).toBe('paused');}
  finally{await s.app.close();await pool.end();}
 });
});
