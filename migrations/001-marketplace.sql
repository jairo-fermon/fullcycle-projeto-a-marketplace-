CREATE SCHEMA catalog;
CREATE SCHEMA orders;
CREATE SCHEMA payments;
CREATE TABLE catalog.products (
 id UUID PRIMARY KEY, sku VARCHAR(64) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL,
 category VARCHAR(32) NOT NULL, unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents BETWEEN 1 AND 1000000), created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE orders.orders (
 id UUID PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('PENDING','PAID')),
 total_cents BIGINT NOT NULL CHECK(total_cents BETWEEN 1 AND 100000000000),
 created_at TIMESTAMPTZ NOT NULL, payment_reference UUID UNIQUE,
 origin TEXT NOT NULL DEFAULT 'api' CHECK(origin IN ('api','synthetic_seed')),
 CHECK((status='PENDING' AND payment_reference IS NULL) OR (status='PAID' AND payment_reference IS NOT NULL))
);
CREATE TABLE orders.items (
 order_id UUID NOT NULL REFERENCES orders.orders(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99), product_id UUID NOT NULL,
 sku VARCHAR(64) NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 1000),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents BETWEEN 1 AND 1000000), PRIMARY KEY(order_id,position)
);
CREATE TABLE payments.attempts (
 id UUID PRIMARY KEY, order_id UUID NOT NULL, idempotency_key UUID NOT NULL UNIQUE,
 amount_cents BIGINT NOT NULL CHECK(amount_cents>0), outcome TEXT NOT NULL CHECK(outcome IN ('approve','decline')),
 status TEXT NOT NULL CHECK(status IN ('QUEUED','SUCCEEDED','DECLINED','FAILED')), created_at TIMESTAMPTZ NOT NULL,
 processed_at TIMESTAMPTZ, origin TEXT NOT NULL DEFAULT 'api' CHECK(origin IN ('api','synthetic_seed'))
);
CREATE TABLE payments.jobs (
 id UUID PRIMARY KEY REFERENCES payments.attempts(id), state TEXT NOT NULL DEFAULT 'READY' CHECK(state IN ('READY','DONE','DEAD')),
 deliveries INTEGER NOT NULL DEFAULT 0, available_at TIMESTAMPTZ NOT NULL DEFAULT now(), trace_context JSONB NOT NULL,
 last_error_code TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_jobs_ready ON payments.jobs(available_at) WHERE state='READY';
CREATE TABLE payments.receipts (payment_id UUID PRIMARY KEY REFERENCES payments.attempts(id), processed_at TIMESTAMPTZ NOT NULL);
