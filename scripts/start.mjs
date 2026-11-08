import { Pool } from 'pg';
import { readConfig } from '../dist/config.js';
import { migrate } from '../dist/platform/migrate.js';
import { buildApp } from '../dist/app.js';
let pool, app, timer, active;
try {
  const config = readConfig(process.env); pool = new Pool(config.database);
  pool.on('error', () => app?.log.error({ code: 'DATABASE_CONNECTION_ERROR' }, 'database_connection_failed'));
  await migrate(pool);
  const modules = buildApp(pool, { cacheEnabled: config.cacheEnabled, cacheTtlMs: config.cacheTtlMs, paymentsEnabled: config.paymentsEnabled, logLevel: config.logLevel });
  app = modules.app;
  await app.listen({ port: config.port, host: config.host });
  timer = setInterval(() => {
    if (!active) active = modules.workOnce().catch(() => app.log.error({ code: 'WORKER_ERROR' }, 'worker_failed')).finally(() => { active = undefined; });
  }, config.workerIntervalMs);
  const shutdown = async () => { clearInterval(timer); await active; await app.close(); await pool.end(); await globalThis.marketplaceTelemetryShutdown?.(); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
} catch {
  clearInterval(timer); console.error(JSON.stringify({ code: 'STARTUP_FAILED', message: 'Verifique configuração, banco e migrations.' }));
  await app?.close(); await pool?.end(); await globalThis.marketplaceTelemetryShutdown?.(); process.exitCode = 1;
}
