import type { Pool } from 'pg';
import { PostgresProducts } from './repository.js';
import { CatalogService } from './service.js';
import type { Product } from './domain.js';
export type { Product } from './domain.js';
export interface CatalogPort { prices(ids: string[]): Promise<Product[]> }
export function createCatalog(pool: Pool, options: { cacheEnabled: boolean; ttlMs: number; onCache?: (state: 'hit' | 'miss' | 'bypass') => void }) {
  const repository = new PostgresProducts(pool);
  const service = new CatalogService(repository, options.cacheEnabled, options.ttlMs, Date.now, options.onCache);
  return {
    create: service.create.bind(service), list: service.list.bind(service), prices: service.prices.bind(service),
    seed: repository.seed.bind(repository)
  };
}
