export function readConfig(env: NodeJS.ProcessEnv) {
  const required = (name: string) => { const value = env[name]; if (!value?.trim()) throw new Error(`Variável obrigatória: ${name}`); return value; };
  const number = (value: string, min: number, max: number) => { const result = Number(value); if (!Number.isInteger(result) || result < min || result > max) throw new Error('Configuração numérica inválida.'); return result; };
  const flag = (value: string) => { if (!['true', 'false'].includes(value)) throw new Error('Flag deve ser true ou false.'); return value === 'true'; };
  const environment = env.APP_ENV ?? 'development';
  if (!['development', 'production', 'test'].includes(environment)) throw new Error('APP_ENV inválido.');
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'].includes(logLevel)) throw new Error('LOG_LEVEL inválido.');
  return {
    database: { host: required('PGHOST'), port: number(env.PGPORT ?? '5432', 1, 65535), database: required('PGDATABASE'), user: required('PGUSER'), password: required('PGPASSWORD'), max: 20, connectionTimeoutMillis: 5000, statement_timeout: 10000 },
    port: number(env.PORT ?? '3001', 1, 65535), host: env.HOST ?? '0.0.0.0', environment, logLevel,
    cacheEnabled: flag(env.CATALOG_CACHE_ENABLED ?? 'true'), cacheTtlMs: number(env.CACHE_TTL_MS ?? '5000', 1, 60000),
    paymentsEnabled: flag(env.PAYMENT_PROCESSING_ENABLED ?? 'true'), workerIntervalMs: number(env.WORKER_INTERVAL_MS ?? '100', 10, 10000)
  };
}
