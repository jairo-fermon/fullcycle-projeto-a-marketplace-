import { describe, expect, it, vi } from 'vitest';
import { newProduct } from '../../src/modules/catalog/domain.js';
import type { ProductRepository } from '../../src/modules/catalog/domain.js';
import { CatalogService } from '../../src/modules/catalog/service.js';
const input={sku:'CANETA',name:'Caneta azul',category:'geral',unitPriceCents:101};
function fixture(enabled=true,ttl=50,clock=()=>0){
 const product=newProduct(input);
 const repository:ProductRepository={create:vi.fn(async p=>p),list:vi.fn(async()=>[product]),find:vi.fn(async()=>[product]),seed:vi.fn(async()=>{})};
 const metric=vi.fn();return {product,repository,metric,service:new CatalogService(repository,enabled,ttl,clock,metric)};
}
describe('Catálogo e cache com tolerância explícita',()=>{
 it('valida produto, gera identificador e rejeita limites inválidos',()=>{
  expect(newProduct(input)).toMatchObject(input);
  for(const invalid of [{...input,sku:'a b'},{...input,name:' '},{...input,name:'x'.repeat(121)},{...input,category:'Inválida'},{...input,unitPriceCents:0},{...input,unitPriceCents:1.1},{...input,unitPriceCents:1000001}])expect(()=>newProduct(invalid)).toThrow();
 });
 it('cache hit evita consulta, protege mutação e expira no TTL',async()=>{
  let now=0;const f=fixture(true,50,()=>now);
  expect((await f.service.list('geral',20)).cache).toBe('miss');
  const hit=await f.service.list('geral',20);hit.items[0]!.name='alterado';
  expect((await f.service.list('geral',20)).items[0]!.name).toBe('Caneta azul');expect(f.repository.list).toHaveBeenCalledTimes(1);
  now=50;expect((await f.service.list('geral',20)).cache).toBe('miss');expect(f.repository.list).toHaveBeenCalledTimes(2);
  expect(f.metric).toHaveBeenCalledWith('hit');
 });
 it('invalida ao criar e não usa cache para precificar pedidos',async()=>{
  const f=fixture();await f.service.list('geral',20);await f.service.create({...input,sku:'OUTRA'});
  expect((await f.service.list('geral',20)).cache).toBe('miss');
  f.product.unitPriceCents=500;expect((await f.service.prices([f.product.id]))[0]!.unitPriceCents).toBe(500);
  vi.mocked(f.repository.find).mockResolvedValue([]);await expect(f.service.prices([f.product.id])).rejects.toMatchObject({code:'NOT_FOUND'});
 });
 it('flag desliga cache e limita chaves em memória',async()=>{
  const disabled=fixture(false);expect((await disabled.service.list('geral',20)).cache).toBe('bypass');await disabled.service.list('geral',20);expect(disabled.repository.list).toHaveBeenCalledTimes(2);
  const f=fixture();for(let i=0;i<=100;i++)await f.service.list(`category-${i}`,20);
  expect((await f.service.list('category-0',20)).cache).toBe('miss');
  await expect(f.service.list('BAD',20)).rejects.toThrow();await expect(f.service.list('geral',0)).rejects.toThrow();
  await expect(f.service.list('geral',51)).rejects.toThrow();
 });
 it('não recoloca resultado antigo de consulta em voo após invalidação',async()=>{
  const f=fixture();let finish!:(value:typeof f.product[])=>void;
  vi.mocked(f.repository.list).mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
  const pending=f.service.list('geral',20);await f.service.create({...input,sku:'NOVA'});finish([f.product]);await pending;
  expect((await f.service.list('geral',20)).cache).toBe('miss');
 });
 it('callback de métrica opcional não altera negócio',async()=>{
  const f=fixture();const service=new CatalogService(f.repository,false,50);expect((await service.list('geral',1)).items).toHaveLength(1);
 });
});
