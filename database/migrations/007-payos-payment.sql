-- One payOS channel; keep the existing payment/webhook/outbox/ticket tables.
-- Back up before applying. Recovery: restore the pre-007 backup with prior code.
BEGIN;
ALTER TABLE payments
  ADD COLUMN checkout_url VARCHAR(1000) NULL,
  ADD COLUMN received_minor BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN last_polled_at TIMESTAMPTZ(6) NULL,
  ADD CONSTRAINT ck_payment_received CHECK (received_minor>=0);
CREATE INDEX ix_payment_poll ON payments(last_polled_at,id) WHERE provider='PAYOS' AND status='PENDING';
COMMIT;
