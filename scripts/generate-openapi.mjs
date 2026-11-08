import { writeFileSync, mkdirSync } from 'node:fs';
import { stringify } from 'yaml';
import { productInput, orderInput, paymentInput, responseSchemas, uuid } from '../dist/http/schemas.js';
const json = schema => ({ 'application/json': { schema } });
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const response = (name, description) => ({ description, content: json(ref(name)) });
const errors = (...codes) => Object.fromEntries(codes.map(code => [code, response('Error', ({400:'Entrada inválida.',404:'Recurso não encontrado.',409:'Conflito ou idempotência incompatível.',413:'Corpo acima de 64 KiB.',415:'Tipo de conteúdo não suportado.',500:'Erro interno sem detalhes sensíveis.',503:'Processamento suspenso pela feature flag.'})[code]) ]));
const body = (schema, example) => ({ required: true, content: { 'application/json': { schema, example } } });
const pathId = { name: 'id', in: 'path', required: true, schema: uuid };
const query = (name, schema, description) => ({ name, in: 'query', required: false, schema, description });
const operation = (operationId, summary, tag, extra) => ({ operationId, summary, tags: [tag], ...extra });
const list = name => ({ type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: ref(name) } } });
const doc = {
  openapi: '3.1.0', info: { title: 'Marketplace modular - Projeto A Full Cycle', version: '1.0.0', description: 'Catálogo, Pedidos e Pagamento simulado; sem cobrança real. Moeda em centavos inteiros. Fila PostgreSQL e processamento assíncrono.' },
  servers: [{ url: 'http://localhost:{port}', variables: { port: { default: '3001' } } }], security: [],
  tags: ['Catalogo','Pedidos','Pagamento','Operacao'].map(name => ({ name, description: name })),
  paths: {
    '/catalog/products': {
      post: operation('createProduct','Cadastrar produto','Catalogo',{ requestBody: body(productInput,{sku:'CANETA-AZUL',name:'Caneta azul',category:'geral',unitPriceCents:1500}), responses: {201:response('Product','Produto cadastrado.'),...errors(400,409,413,415,500)} }),
      get: operation('listProducts','Listar catálogo por categoria','Catalogo',{ parameters:[query('category',{type:'string',pattern:'^[a-z0-9-]{1,32}$',default:'geral'},'Categoria; cache TTL configurável, padrão 5 segundos.'),query('limit',{type:'integer',minimum:1,maximum:50,default:20},'Quantidade máxima.')], responses:{200:response('ProductList','Produtos; x-cache informa hit, miss ou bypass.'),...errors(400,500)} })
    },
    '/orders': {
      post:operation('createOrder','Criar pedido com preços atuais do catálogo','Pedidos',{requestBody:body(orderInput,{items:[{productId:'00000001-0000-4000-8000-000000000001',quantity:2}]}),responses:{201:response('Order','Pedido persistido PENDING. Total calculado pelo servidor, sem cache de preço.'),...errors(400,404,413,415,500)}}),
      get:operation('listOrders','Listar pedidos por status, ordenados por data e ID decrescentes','Pedidos',{parameters:[query('status',{type:'string',enum:['PENDING','PAID'],default:'PENDING'},'Status.'),query('limit',{type:'integer',minimum:1,maximum:50,default:20},'Itens por página.'),query('page',{type:'integer',minimum:1,maximum:5000,default:1},'Página; offset limitado.')],responses:{200:response('OrderList','Resumo de pedidos persistidos.'),...errors(400,500)}})
    },
    '/orders/{id}': {parameters:[pathId],get:operation('getOrder','Consultar pedido e estado de pagamento','Pedidos',{responses:{200:response('Order','Pedido persistido.'),...errors(400,404,500)}})},
    '/payments': {post:operation('submitPayment','Enfileirar tentativa de pagamento simulado','Pagamento',{parameters:[{name:'Idempotency-Key',in:'header',required:true,schema:uuid,description:'Mesmo UUID e payload retornam a mesma tentativa; payload diferente recebe 409.'}],requestBody:body(paymentInput,{orderId:'00000002-0000-4000-8000-000000000001',outcome:'approve'}),responses:{200:response('Payment','Solicitação já existente, sem nova tentativa/fila.'),202:response('Payment','Tentativa registrada; consultar GET /payments/{id} para estado final.'),...errors(400,404,409,413,415,500,503)}})},
    '/payments/{id}':{parameters:[pathId],get:operation('getPayment','Consultar resultado auditável da simulação','Pagamento',{responses:{200:response('Payment','Estado QUEUED, SUCCEEDED, DECLINED ou FAILED e número de entregas.'),...errors(400,404,500)}})},
    '/health':{get:operation('health','Verificar conexão real com PostgreSQL','Operacao',{responses:{200:{description:'Aplicação e banco disponíveis.',content:json({type:'object',required:['status'],additionalProperties:false,properties:{status:{const:'ok'}}})},503:{description:'Banco indisponível.',content:json({type:'object',required:['status'],additionalProperties:false,properties:{status:{const:'unavailable'}}})}}})},
    '/metrics':{get:operation('metrics','Consultar métricas RED e fila/cache','Operacao',{responses:{200:{description:'Formato Prometheus; labels de rota normalizada.',content:{'text/plain':{schema:{type:'string'}}}}}})}
  }, components:{schemas:{...responseSchemas,ProductList:list('Product'),OrderList:list('OrderSummary')}}
};
mkdirSync(new URL('../docs/',import.meta.url),{recursive:true}); writeFileSync(new URL('../docs/openapi.yaml',import.meta.url),stringify(doc));
console.log('OpenAPI 3.1 gerada; validar lint e compatibilidade com respostas reais.');
