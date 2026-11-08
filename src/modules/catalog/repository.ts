import type { Pool } from 'pg';
import type { Product, ProductRepository } from './domain.js';
import { query } from '../../platform/database.js';
import { AppError } from '../../platform/errors.js';
type ProductRow = Omit<Product, 'createdAt'> & { createdAt: Date };
const columns = 'id,sku,name,category,unit_price_cents AS "unitPriceCents",created_at AS "createdAt"';
const convert = (row: ProductRow): Product => ({ ...row, createdAt: row.createdAt.toISOString() });
export class PostgresProducts implements ProductRepository {
  constructor(private pool: Pool) {}
  async create(product: Product): Promise<Product> {
    try {
      await query(this.pool, 'catalog.insert', 'INSERT INTO catalog.products(id,sku,name,category,unit_price_cents,created_at) VALUES($1,$2,$3,$4,$5,$6)',
        [product.id, product.sku, product.name, product.category, product.unitPriceCents, product.createdAt]);
      return product;
    } catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw new AppError('CONFLICT', 'SKU já cadastrado.'); throw error; }
  }
  async list(category: string, limit: number): Promise<Product[]> {
    return (await query<ProductRow>(this.pool, 'catalog.list', `SELECT ${columns} FROM catalog.products WHERE category=$1 ORDER BY name,id LIMIT $2`, [category, limit])).rows.map(convert);
  }
  async find(ids: string[]): Promise<Product[]> {
    return (await query<ProductRow>(this.pool, 'catalog.find', `SELECT ${columns} FROM catalog.products WHERE id=ANY($1::uuid[])`, [ids])).rows.map(convert);
  }
  async seed(products: Product[]): Promise<void> {
    await query(this.pool, 'catalog.seed', `INSERT INTO catalog.products(id,sku,name,category,unit_price_cents,created_at)
      SELECT id,sku,name,category,"unitPriceCents","createdAt" FROM jsonb_to_recordset($1::jsonb)
      AS x(id uuid,sku text,name text,category text,"unitPriceCents" integer,"createdAt" timestamptz) ON CONFLICT(id) DO NOTHING`, [JSON.stringify(products)]);
  }
}
