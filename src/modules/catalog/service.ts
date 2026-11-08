import type { Product, ProductRepository } from './domain.js';
import { newProduct } from './domain.js';
import { AppError, ensure } from '../../platform/errors.js';
import { traced } from '../../platform/telemetry.js';
export class CatalogService {
  private cache = new Map<string, { expiresAt: number; items: Product[] }>();
  private generation = 0;
  constructor(private repository: ProductRepository, private enabled: boolean, private ttlMs: number,
    private now: () => number = Date.now, private hit: (result: 'hit' | 'miss' | 'bypass') => void = () => {}) {}
  async create(input: Parameters<typeof newProduct>[0]): Promise<Product> {
    return traced('catalog.create', async () => {
      const product = await this.repository.create(newProduct(input));
      this.generation++; this.cache.clear(); return product;
    });
  }
  async list(category: string, limit: number): Promise<{ items: Product[]; cache: 'hit' | 'miss' | 'bypass' }> {
    ensure(/^[a-z0-9-]{1,32}$/.test(category) && Number.isInteger(limit) && limit >= 1 && limit <= 50, 'Filtro inválido.');
    return traced('catalog.list', async () => {
      const key = `${category}:${limit}`;
      const existing = this.cache.get(key);
      if (this.enabled && existing && existing.expiresAt > this.now()) { this.hit('hit'); return { items: structuredClone(existing.items), cache: 'hit' }; }
      const generation = this.generation;
      const items = await this.repository.list(category, limit);
      if (this.enabled && generation === this.generation) {
        if (this.cache.size >= 100) this.cache.clear();
        this.cache.set(key, { expiresAt: this.now() + this.ttlMs, items: structuredClone(items) });
      }
      const state = this.enabled ? 'miss' : 'bypass'; this.hit(state); return { items, cache: state };
    });
  }
  async prices(ids: string[]): Promise<Product[]> {
    const products = await this.repository.find(ids);
    if (products.length !== new Set(ids).size) throw new AppError('NOT_FOUND', 'Um ou mais produtos não existem.');
    return products; // Preços para pedidos sempre consultam banco, sem cache potencialmente desatualizado.
  }
}
