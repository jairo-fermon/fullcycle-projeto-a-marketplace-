import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
const orderDuration=new Trend('orders_list_duration',true), catalogDuration=new Trend('catalog_list_duration',true);
export const options={summaryTrendStats:['avg','min','med','max','p(90)','p(95)','p(99)','count'],stages:[{duration:'10s',target:5},{duration:'15s',target:15},{duration:'10s',target:0}],thresholds:{orders_list_duration:['p(95)<500'],catalog_list_duration:['p(95)<500'],http_req_failed:['rate==0'],checks:['rate==1']}};
if(!__ENV.BASE_URL)throw new Error('BASE_URL obrigatória.');
function record(response,route,trend){
 trend.add(response.timings.duration);
 // IDs somente no log de amostras lentas; nunca como labels de metricas.
 if(response.timings.duration>500){
  const header=name=>{const value=response.headers[name];return Array.isArray(value)?value[0]:value??'';};
  console.warn(JSON.stringify({event:'slow_request',completedAt:new Date().toISOString(),scenario:__ENV.BENCHMARK_CASE??'standard',round:__ENV.BENCHMARK_ROUND??'',route,status:response.status,requestId:header('X-Request-Id'),traceId:header('X-Trace-Id'),timingsMs:response.timings}));
 }
}
export default function(){
 const orders=http.get(`${__ENV.BASE_URL}/orders?status=PENDING&limit=20&page=1`,{tags:{name:'GET /orders'}});record(orders,'GET /orders',orderDuration);
 check(orders,{'lista de pedidos válida':r=>r.status===200&&Array.isArray(r.json('items'))&&r.json('items').length===20});
 const products=http.get(`${__ENV.BASE_URL}/catalog/products?category=category-01&limit=20`,{tags:{name:'GET /catalog/products'}});record(products,'GET /catalog/products',catalogDuration);
 check(products,{'catálogo válido':r=>r.status===200&&Array.isArray(r.json('items'))&&r.json('items').length===20});sleep(0.1);
}
