import { ensure } from '../../platform/errors.js';
import { randomUUID } from 'node:crypto';
export interface Product { id: string; sku: string; name: string; category: string; unitPriceCents: number; createdAt: string }
export function newProduct(input: { sku: string; name: string; category: string; unitPriceCents: number }): Product {
  ensure(typeof input.sku === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(input.sku), 'SKU inválido.');
  ensure(typeof input.name === 'string' && input.name.trim().length > 0 && input.name.length <= 120, 'Nome inválido.');
  ensure(typeof input.category === 'string' && /^[a-z0-9-]{1,32}$/.test(input.category), 'Categoria inválida.');
  ensure(Number.isInteger(input.unitPriceCents) && input.unitPriceCents >= 1 && input.unitPriceCents <= 1000000, 'Preço inválido.');
  return { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
}
export interface ProductRepository {
  create(product: Product): Promise<Product>;
  list(category: string, limit: number): Promise<Product[]>;
  find(ids: string[]): Promise<Product[]>;
  seed(products: Product[]): Promise<void>;
}
