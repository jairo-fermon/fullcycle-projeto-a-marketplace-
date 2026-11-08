import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
const orderDuration=new Trend('orders_list_duration',true), catalogDuration=new Trend('catalog_list_duration',true);
export const options={stages:[{duration:'10s',target:5},{duration:'15s',target:15},{duration:'10s',target:0}],thresholds:{orders_list_duration:['p(95)<500'],catalog_list_duration:['p(95)<500'],http_req_failed:['rate==0'],checks:['rate==1']}};
if(!__ENV.BASE_URL)throw new Error('BASE_URL obrigatória.');
export default function(){
 const orders=http.get(`${__ENV.BASE_URL}/orders?status=PENDING&limit=20&page=1`,{tags:{name:'GET /orders'}});orderDuration.add(orders.timings.duration);
 check(orders,{'lista de pedidos válida':r=>r.status===200&&Array.isArray(r.json('items'))&&r.json('items').length===20});
 const products=http.get(`${__ENV.BASE_URL}/catalog/products?category=category-01&limit=20`,{tags:{name:'GET /catalog/products'}});catalogDuration.add(products.timings.duration);
 check(products,{'catálogo válido':r=>r.status===200&&Array.isArray(r.json('items'))&&r.json('items').length===20});sleep(0.1);
}
