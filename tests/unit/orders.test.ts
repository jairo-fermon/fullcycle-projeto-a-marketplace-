import { describe, expect, it, vi } from 'vitest';
import { newOrder, validateItems } from '../../src/modules/orders/domain.js';
import type { OrderRepository, RequestedItem } from '../../src/modules/orders/domain.js';
import { OrderService } from '../../src/modules/orders/service.js';
import { seedProducts } from '../../src/platform/seed-plan.js';
const product=seedProducts(1)[0]!;const items=[{productId:product.id,quantity:3}];
function fixture(){const order=newOrder(items,[product]);const repository:OrderRepository={
 create:vi.fn(async o=>o),get:vi.fn(async()=>order),list:vi.fn(async()=>[order]),markPaid:vi.fn(async()=>{}),seed:vi.fn(async()=>{}),seedCount:vi.fn(async()=>0),optimize:vi.fn(async()=>{}),explain:vi.fn(async()=>({}))};
 const catalog={prices:vi.fn(async()=>[product])};return {order,repository,catalog,service:new OrderService(repository,catalog)};}
describe('Pedidos: snapshots de preço e transições',()=>{
 it('calcula centavos com preço do catálogo e aceita valor máximo seguro',()=>{
  expect(newOrder(items,[product])).toMatchObject({totalCents:300,status:'PENDING',paymentReference:null});
  const products=seedProducts(100).map(p=>({...p,unitPriceCents:1000000}));
  expect(newOrder(products.map(p=>({productId:p.id,quantity:1000})),products).totalCents).toBe(100000000000);
 });
 it.each([null,{},[],Array(101).fill(items[0]),[null],[{productId:'x',quantity:1}],[{...items[0],quantity:0}],[{...items[0],quantity:1001}],[{...items[0],quantity:1.5}],[items[0],items[0]]])('rejeita entrada inválida %#',value=>expect(()=>validateItems(value as RequestedItem[])).toThrow());
 it('exige produto e total seguro',()=>{
  expect(()=>newOrder(items,[])).toThrow('Produto não encontrado');
  expect(()=>newOrder(items,[{...product,unitPriceCents:NaN}])).toThrow('Total inválido');
 });
 it('serviço consulta só interface pública e persiste snapshot',async()=>{
  const f=fixture();const created=await f.service.create(items);expect(created.totalCents).toBe(300);expect(f.catalog.prices).toHaveBeenCalledWith([product.id]);expect(f.repository.create).toHaveBeenCalledWith(created);
  expect(await f.service.get(f.order.id)).toBe(f.order);expect(await f.service.paymentSnapshot(f.order.id)).toEqual({id:f.order.id,status:'PENDING',totalCents:300});
  expect(await f.service.list('PENDING',20,1)).toHaveLength(1);await f.service.markPaid(f.order.id,'payment');expect(f.repository.markPaid).toHaveBeenCalledWith(f.order.id,'payment');
  vi.mocked(f.repository.get).mockResolvedValue(null);await expect(f.service.get(f.order.id)).rejects.toMatchObject({code:'NOT_FOUND'});
 });
 it('recusa paginação e status inválidos',async()=>{
  const f=fixture();for(const [status,limit,page]of [['BAD',20,1],['PENDING',0,1],['PENDING',51,1],['PENDING',20,0],['PENDING',20,5001]]as const)await expect(f.service.list(status as 'PENDING',limit,page)).rejects.toThrow();
 });
});
