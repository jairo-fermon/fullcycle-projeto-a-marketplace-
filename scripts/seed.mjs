import { Pool } from 'pg';
import { readConfig } from '../dist/config.js';
import { migrate } from '../dist/platform/migrate.js';
import { seedProducts, seedBatch } from '../dist/platform/seed-plan.js';
import { buildApp } from '../dist/app.js';
const config = readConfig(process.env); const pool = new Pool(config.database);
const modules = buildApp(pool, { cacheEnabled: false, cacheTtlMs: 5000, paymentsEnabled: true, logLevel: 'silent' });
try {
  await migrate(pool);
  const products = seedProducts(5000); await modules.catalog.seed(products);
  for (let start = 1; start <= 100000; start += 5000) {
    const batch = seedBatch(start, 5000, products); await modules.orders.seed(batch.orders); await modules.payments.seed(batch.payments);
    console.log(JSON.stringify({ synthetic: true, completed: start + 4999, target: 100000 }));
  }
  console.log(JSON.stringify({ result: 'PASSOU', syntheticOrders: await modules.orders.seedCount() }));
} finally { await modules.app.close(); await pool.end(); }
