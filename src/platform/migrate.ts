import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { transaction } from './database.js';
export async function migrate(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(873021)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL)');
    const directory = new URL('../../migrations/', import.meta.url);
    for (const file of (await readdir(directory)).filter(f => f.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(file, directory), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ sha256: string }>('SELECT sha256 FROM schema_migrations WHERE name=$1', [file]);
      if (existing.rows[0]) { if (existing.rows[0].sha256 !== hash) throw new Error('Migration aplicada foi alterada.'); continue; }
      await client.query(sql); await client.query('INSERT INTO schema_migrations VALUES($1,$2)', [file, hash]);
    }
  });
}
