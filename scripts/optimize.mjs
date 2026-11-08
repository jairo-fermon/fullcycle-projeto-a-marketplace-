import { Pool } from 'pg';
import { readConfig } from '../dist/config.js';
import { buildApp } from '../dist/app.js';
const pool = new Pool(readConfig(process.env).database);
const modules = buildApp(pool, { cacheEnabled: false, cacheTtlMs: 5000, paymentsEnabled: true, logLevel: 'silent' });
try {
  if (!['baseline','optimized','explain'].includes(process.argv[2])) throw new Error('Use baseline, optimized ou explain.');
  if (process.argv[2] !== 'explain') await modules.orders.optimize(process.argv[2] === 'optimized');
  console.log(JSON.stringify({ scenario: process.argv[2], explain: await modules.orders.explain() }, null, 2));
} finally { await modules.app.close(); await pool.end(); }
