-- +goose Up
-- +goose StatementBegin
ALTER TABLE payments ADD COLUMN IF NOT EXISTS state_version bigint NOT NULL DEFAULT 1;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS commerce_synced_version bigint NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconcile_after timestamptz NOT NULL DEFAULT now();
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconcile_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconcile_lease_token uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconcile_lease_until timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconcile_last_error text;

-- Previously saved payments begin unsynchronized exactly once. Replaying this
-- migration preserves acknowledgements, retries and active leases.
CREATE INDEX IF NOT EXISTS payments_reconciliation_due_idx
ON payments (reconcile_after, id)
WHERE state_version > commerce_synced_version
   OR (channel = 'WECHAT_B2B' AND status = 'PAY_PENDING');
CREATE INDEX IF NOT EXISTS payments_order_attempt_idx ON payments(order_id, created_at DESC, id DESC);

-- Old application instances may update the payment during rolling deployment
-- without knowing about state_version. Keep their status writes recoverable too.
CREATE OR REPLACE FUNCTION mark_payment_reconciliation_due() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'PAID' THEN
        NEW.status := OLD.status;
        NEW.paid_at := OLD.paid_at;
        NEW.provider_trade_no := OLD.provider_trade_no;
        NEW.failure_code := OLD.failure_code;
        NEW.failure_message := OLD.failure_message;
        NEW.closed_at := OLD.closed_at;
    END IF;
    IF ROW(NEW.status, NEW.channel, NEW.provider_trade_no, NEW.paid_at)
        IS DISTINCT FROM ROW(OLD.status, OLD.channel, OLD.provider_trade_no, OLD.paid_at) THEN
        NEW.state_version := OLD.state_version + 1;
        NEW.reconcile_after := now();
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER payments_mark_reconciliation_due
BEFORE UPDATE OF status, channel, provider_trade_no, paid_at ON payments
FOR EACH ROW EXECUTE FUNCTION mark_payment_reconciliation_due();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS payments_mark_reconciliation_due ON payments;
DROP FUNCTION IF EXISTS mark_payment_reconciliation_due();
DROP INDEX IF EXISTS payments_reconciliation_due_idx;
DROP INDEX IF EXISTS payments_order_attempt_idx;
ALTER TABLE payments DROP COLUMN IF EXISTS reconcile_last_error;
ALTER TABLE payments DROP COLUMN IF EXISTS reconcile_lease_until;
ALTER TABLE payments DROP COLUMN IF EXISTS reconcile_lease_token;
ALTER TABLE payments DROP COLUMN IF EXISTS reconcile_attempts;
ALTER TABLE payments DROP COLUMN IF EXISTS reconcile_after;
ALTER TABLE payments DROP COLUMN IF EXISTS commerce_synced_version;
ALTER TABLE payments DROP COLUMN IF EXISTS state_version;
-- +goose StatementEnd
