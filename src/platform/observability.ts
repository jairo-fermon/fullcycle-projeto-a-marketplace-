import { Counter, Histogram, Registry } from '@prometheus-io/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
export function instrumentation(app: FastifyInstance) {
  const registry = new Registry();
  const labels = ['method', 'route', 'status'] as const;
  const requests = new Counter({ name: 'http_requests_total', help: 'Rate: contador HTTP; calcular taxa em janela.', labelNames: labels, registers: [registry] });
  const errors = new Counter({ name: 'http_errors_total', help: 'Errors: respostas HTTP >=400.', labelNames: labels, registers: [registry] });
  const duration = new Histogram({ name: 'http_request_duration_seconds', help: 'Duration: histograma de duração HTTP.', labelNames: labels, buckets: [0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5], registers: [registry] });
  const cache = new Counter({ name: 'catalog_cache_requests_total', help: 'Decisões reais do cache.', labelNames: ['result'] as const, registers: [registry] });
  const jobs = new Counter({ name: 'payment_job_results_total', help: 'Resultado real de entrega da fila.', labelNames: ['result'] as const, registers: [registry] });
  const starts = new WeakMap<FastifyRequest, bigint>();
  app.addHook('onRequest', async request => { starts.set(request, process.hrtime.bigint()); });
  app.addHook('onResponse', async (request, reply) => {
    const elapsed = Number(process.hrtime.bigint() - starts.get(request)!) / 1e9;
    const route = request.routeOptions.url ?? 'unmatched';
    if (route !== '/metrics') {
      const values = { method: request.method, route, status: String(reply.statusCode) };
      requests.inc(values); duration.observe(values, elapsed); if (reply.statusCode >= 400) errors.inc(values);
    }
    request.log.info({ method: request.method, route, status: reply.statusCode, durationMs: elapsed * 1000, traceId: reply.getHeader('x-trace-id') ?? '' }, 'request_completed');
  });
  return { registry, cache, jobs };
}
