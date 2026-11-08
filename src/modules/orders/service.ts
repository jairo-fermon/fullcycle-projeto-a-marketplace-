import type { CatalogPort } from '../catalog/index.js';
import type { Order, OrderRepository, RequestedItem } from './domain.js';
import { newOrder, validateItems } from './domain.js';
import { AppError, ensure } from '../../platform/errors.js';
import { traced } from '../../platform/telemetry.js';
export class OrderService {
  constructor(private repository: OrderRepository, private catalog: CatalogPort) {}
  async create(items: RequestedItem[]): Promise<Order> {
    return traced('orders.create', async () => { validateItems(items); return this.repository.create(newOrder(items, await this.catalog.prices(items.map(i => i.productId)))); });
  }
  async get(id: string): Promise<Order> {
    const order = await this.repository.get(id); if (!order) throw new AppError('NOT_FOUND', 'Pedido não encontrado.'); return order;
  }
  async list(status: Order['status'], limit: number, page: number) {
    ensure(['PENDING', 'PAID'].includes(status) && Number.isInteger(limit) && limit >= 1 && limit <= 50 && Number.isInteger(page) && page >= 1 && page <= 5000, 'Paginação/status inválidos.');
    return traced('orders.list', () => this.repository.list(status, limit, page));
  }
  async paymentSnapshot(id: string) { const order = await this.get(id); return { id: order.id, status: order.status, totalCents: order.totalCents }; }
  async markPaid(id: string, paymentId: string) { return traced('orders.mark_paid', () => this.repository.markPaid(id, paymentId)); }
}
