import { randomUUID } from 'node:crypto';
const base = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? '3001'}`;
async function call(method,path,body,expected,headers={}) {
  const r=await fetch(new URL(path,base),{method,headers:{'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json(); console.log(JSON.stringify({method,path,status:r.status,traceId:r.headers.get('x-trace-id'),data}));
  if(r.status!==expected)throw new Error(`Esperado ${expected}; recebido ${r.status}`); return {data,traceId:r.headers.get('x-trace-id')};
}
const product=(await call('POST','/catalog/products',{sku:`DEMO-${randomUUID()}`,name:'Produto de demonstração',category:'geral',unitPriceCents:1500},201)).data;
await call('GET','/catalog/products?category=geral',null,200);
const order=(await call('POST','/orders',{items:[{productId:product.id,quantity:2}]},201)).data;
if(order.totalCents!==3000)throw new Error('Total incorreto.');
const key=randomUUID(); const request={orderId:order.id,outcome:'approve'};
const queued=await call('POST','/payments',request,202,{'idempotency-key':key});
await call('POST','/payments',request,200,{'idempotency-key':key});
let payment;
for(let i=0;i<100;i++){payment=(await call('GET',`/payments/${queued.data.id}`,null,200)).data;if(payment.status!=='QUEUED')break;await new Promise(resolve=>setTimeout(resolve,100));}
if(payment.status!=='SUCCEEDED')throw new Error('Pagamento não concluído.');
const paid=(await call('GET',`/orders/${order.id}`,null,200)).data;
if(paid.status!=='PAID'||paid.paymentReference!==payment.id)throw new Error('Pedido não atualizado.');
console.log(JSON.stringify({result:'PASSOU',orderId:order.id,paymentId:payment.id,paymentTraceId:queued.traceId}));
