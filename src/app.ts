import Fastify, { LogController } from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Writable } from 'node:stream';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { SpanKind } from '@opentelemetry/api';
import { createCatalog } from './modules/catalog/index.js';
import { createOrders } from './modules/orders/index.js';
import type { RequestedItem } from './modules/orders/index.js';
import { createPayments } from './modules/payments/index.js';
import type { Outcome } from './modules/payments/index.js';
import { productInput, orderInput, paymentInput, uuid } from './http/schemas.js';
import { AppError } from './platform/errors.js';
import { instrumentation } from './platform/observability.js';
import { traced, activeTraceId } from './platform/telemetry.js';
import { query } from './platform/database.js';

export interface AppOptions { cacheEnabled: boolean; cacheTtlMs: number; paymentsEnabled: boolean; logLevel?: string; logStream?: Writable }
export function buildApp(pool: Pool, options: AppOptions) {
  const app = Fastify({ logger: { level: options.logLevel ?? 'info', redact: ['req.headers.authorization', 'req.headers.cookie'], ...(options.logStream ? { stream: options.logStream } : {}) },
    logController: new LogController({ disableRequestLogging: true }), genReqId: () => randomUUID(), bodyLimit: 65536,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } } });
  const metrics = instrumentation(app);
  const catalog = createCatalog(pool, { cacheEnabled: options.cacheEnabled, ttlMs: options.cacheTtlMs, onCache: state => metrics.cache.inc({ result: state }) });
  const orders = createOrders(pool, catalog);
  const payments = createPayments(pool, orders, options.paymentsEnabled);
  app.addHook('onRequest', async (request, reply) => { reply.header('x-request-id', request.id); });
  app.setErrorHandler((error, request, reply) => {
    const typed: { statusCode?: number; validation?: unknown } = error instanceof Error ? error as Error & { statusCode?: number; validation?: unknown } : {};
    let status = 500, code = 'INTERNAL_ERROR', message = 'Erro interno; consulte requestId.';
    if (error instanceof AppError) { status = { INVALID_INPUT: 400, NOT_FOUND: 404, CONFLICT: 409, UNAVAILABLE: 503 }[error.code]; code = error.code; message = error.message; }
    else if (typed.validation || (typed.statusCode && typed.statusCode >= 400 && typed.statusCode < 500)) { status = typed.statusCode ?? 400; code = 'INVALID_INPUT'; message = 'Requisição inválida.'; }
    if (status >= 500) request.log.error({ code }, 'request_failed');
    reply.code(status).send({ error: { code, message, requestId: request.id } });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.', requestId: request.id } }));
  const http = <T>(name: string, request: FastifyRequest, reply: FastifyReply, work: () => Promise<T>) => traced(name, async () => {
    reply.header('x-trace-id', activeTraceId()); return work();
  }, typeof request.headers.traceparent === 'string' ? { traceparent: request.headers.traceparent } : {}, SpanKind.SERVER);
  const idParams = { type: 'object', required: ['id'], additionalProperties: false, properties: { id: uuid } };
  const queryNumber = { type: 'string', pattern: '^[0-9]{1,5}$' };
  app.post<{ Body: { sku: string; name: string; category: string; unitPriceCents: number } }>('/catalog/products', { schema: { body: productInput } }, (request, reply) =>
    http('HTTP POST /catalog/products', request, reply, async () => { const product = await catalog.create(request.body); reply.code(201).header('location', `/catalog/products?category=${product.category}`); return product; }));
  app.get<{ Querystring: { category?: string; limit?: string } }>('/catalog/products', { schema: { querystring: { type: 'object', additionalProperties: false,
    properties: { category: productInput.properties.category, limit: queryNumber } } } }, (request, reply) => http('HTTP GET /catalog/products', request, reply, async () => {
    const result = await catalog.list(request.query.category ?? 'geral', Number(request.query.limit ?? '20')); reply.header('x-cache', result.cache); return { items: result.items };
  }));
  app.post<{ Body: { items: RequestedItem[] } }>('/orders', { schema: { body: orderInput } }, (request, reply) => http('HTTP POST /orders', request, reply, async () => {
    const order = await orders.create(request.body.items); reply.code(201).header('location', `/orders/${order.id}`); return order;
  }));
  app.get<{ Params: { id: string } }>('/orders/:id', { schema: { params: idParams } }, (request, reply) => http('HTTP GET /orders/:id', request, reply, () => orders.get(request.params.id)));
  app.get<{ Querystring: { status?: 'PENDING' | 'PAID'; limit?: string; page?: string } }>('/orders', { schema: { querystring: { type: 'object', additionalProperties: false,
    properties: { status: { type: 'string', enum: ['PENDING', 'PAID'] }, limit: queryNumber, page: queryNumber } } } }, (request, reply) => http('HTTP GET /orders', request, reply, async () => ({ items: await orders.list(request.query.status ?? 'PENDING', Number(request.query.limit ?? '20'), Number(request.query.page ?? '1')) })));
  app.post<{ Body: { orderId: string; outcome: Outcome }; Headers: { 'idempotency-key': string } }>('/payments', { schema: { body: paymentInput,
    headers: { type: 'object', required: ['idempotency-key'], properties: { 'idempotency-key': uuid } } } }, (request, reply) => http('HTTP POST /payments', request, reply, async () => {
    const result = await payments.submit(request.body.orderId, request.body.outcome, request.headers['idempotency-key']); reply.code(result.replayed ? 200 : 202); return result.payment;
  }));
  app.get<{ Params: { id: string } }>('/payments/:id', { schema: { params: idParams } }, (request, reply) => http('HTTP GET /payments/:id', request, reply, () => payments.get(request.params.id)));
  app.get('/health', async (_request, reply) => { try { await query(pool, 'health', 'SELECT 1'); return { status: 'ok' }; } catch { return reply.code(503).send({ status: 'unavailable' }); } });
  app.get('/metrics', async (_request, reply) => reply.type(metrics.registry.contentType).send(await metrics.registry.metrics()));
  const workOnce = async () => { const result = await payments.workOne(); if (result !== 'idle' && result !== 'paused') metrics.jobs.inc({ result }); return result; };
  return { app, catalog, orders, payments, workOnce };
}
