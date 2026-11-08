import { describe,expect,it } from 'vitest';
import { inspect } from '../../scripts/check-boundaries.mjs';
describe('Regras arquiteturais executáveis',()=>{
 it('permite pedidos depender só da API pública de catálogo',()=>expect(inspect("import { CatalogPort } from '../catalog/index.js';",'modules/orders/service.ts')).toEqual([]));
 it('recusa classe privada e direção proibida',()=>{expect(inspect("import { X } from '../catalog/repository.js';",'modules/payments/service.ts').length).toBeGreaterThan(0);expect(inspect("import { X } from '../payments/index.js';",'modules/catalog/service.ts').length).toBeGreaterThan(0);});
 it('recusa SQL de tabela de outro módulo',()=>expect(inspect("const sql='SELECT id FROM orders.orders'",'modules/payments/repository.ts')).toContain('SQL atravessa módulo: modules/payments/repository.ts -> orders'));
 it('permite importações externas e arquivos técnicos',()=>expect(inspect("import { Pool } from 'pg';export type {Product} from './domain.js';",'modules/catalog/index.ts')).toEqual([]));
});
