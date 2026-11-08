export const uuid = { type: 'string', format: 'uuid' };
export const itemInput = { type: 'object', additionalProperties: false, required: ['productId', 'quantity'], properties: { productId: uuid, quantity: { type: 'integer', minimum: 1, maximum: 1000 } } };
export const productInput = { type: 'object', additionalProperties: false, required: ['sku', 'name', 'category', 'unitPriceCents'], properties: {
  sku: { type: 'string', pattern: '^[A-Za-z0-9._-]{1,64}$' }, name: { type: 'string', minLength: 1, maxLength: 120 },
  category: { type: 'string', pattern: '^[a-z0-9-]{1,32}$' }, unitPriceCents: { type: 'integer', minimum: 1, maximum: 1000000 }
} };
export const orderInput = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', minItems: 1, maxItems: 100, items: itemInput } } };
export const paymentInput = { type: 'object', additionalProperties: false, required: ['orderId', 'outcome'], properties: { orderId: uuid, outcome: { type: 'string', enum: ['approve', 'decline'] } } };
const pricedItem = { ...itemInput, required: ['productId', 'quantity', 'sku', 'unitPriceCents'], properties: { ...itemInput.properties, sku: productInput.properties.sku, unitPriceCents: productInput.properties.unitPriceCents } };
const summary = { type: 'object', additionalProperties: false, required: ['id', 'status', 'totalCents', 'createdAt', 'paymentReference'], properties: {
  id: uuid, status: { type: 'string', enum: ['PENDING', 'PAID'] }, totalCents: { type: 'integer', minimum: 1, maximum: 100000000000 },
  createdAt: { type: 'string', format: 'date-time' }, paymentReference: { type: ['string', 'null'], format: 'uuid' }
} };
export const responseSchemas = {
  Product: { ...productInput, required: [...productInput.required, 'id', 'createdAt'], properties: { ...productInput.properties, id: uuid, createdAt: { type: 'string', format: 'date-time' } } },
  OrderSummary: summary,
  Order: { ...summary, required: [...summary.required, 'items'], properties: { ...summary.properties, items: { type: 'array', minItems: 1, maxItems: 100, items: pricedItem } } },
  Payment: { type: 'object', additionalProperties: false, required: ['id', 'orderId', 'idempotencyKey', 'amountCents', 'outcome', 'status', 'createdAt', 'processedAt', 'deliveries'], properties: {
    id: uuid, orderId: uuid, idempotencyKey: uuid, amountCents: { type: 'integer', minimum: 1, maximum: 100000000000 },
    outcome: { type: 'string', enum: ['approve', 'decline'] }, status: { type: 'string', enum: ['QUEUED', 'SUCCEEDED', 'DECLINED', 'FAILED'] },
    createdAt: { type: 'string', format: 'date-time' }, processedAt: { type: ['string', 'null'], format: 'date-time' }, deliveries: { type: 'integer', minimum: 0 }
  } },
  Error: { type: 'object', additionalProperties: false, required: ['error'], properties: { error: {
    type: 'object', additionalProperties: false, required: ['code', 'message', 'requestId'], properties: {
      code: { type: 'string', enum: ['INVALID_INPUT', 'NOT_FOUND', 'CONFLICT', 'UNAVAILABLE', 'INTERNAL_ERROR'] }, message: { type: 'string' }, requestId: uuid
    }
  } } }
};
