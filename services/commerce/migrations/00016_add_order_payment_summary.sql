-- +goose Up
-- +goose StatementBegin
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'UNPAID',
    ADD COLUMN IF NOT EXISTS latest_payment_id uuid,
    ADD COLUMN IF NOT EXISTS payment_channel text,
    ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status);
CREATE INDEX IF NOT EXISTS orders_latest_payment_id_idx ON orders(latest_payment_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS orders_latest_payment_id_idx;
DROP INDEX IF EXISTS orders_payment_status_idx;

ALTER TABLE orders
    DROP COLUMN IF EXISTS paid_at,
    DROP COLUMN IF EXISTS payment_channel,
    DROP COLUMN IF EXISTS latest_payment_id,
    DROP COLUMN IF EXISTS payment_status;
-- +goose StatementEnd
