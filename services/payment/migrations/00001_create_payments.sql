-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    payer_user_id uuid,
    channel text NOT NULL,
    status text NOT NULL,
    amount_fen bigint NOT NULL,
    currency text NOT NULL DEFAULT 'CNY',
    idempotency_key text,
    provider_trade_no text,
    provider_prepay_id text,
    provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    failure_code text,
    failure_message text,
    paid_at timestamptz,
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_order_channel_idempotency_idx
    ON payments(order_id, channel, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
CREATE INDEX IF NOT EXISTS payments_channel_idx ON payments(channel);

CREATE TABLE IF NOT EXISTS payment_webhooks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
    provider text NOT NULL,
    event_type text NOT NULL,
    delivery_status text NOT NULL,
    raw_body jsonb NOT NULL DEFAULT '{}'::jsonb,
    replay_count integer NOT NULL DEFAULT 0,
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_webhooks_payment_idx ON payment_webhooks(payment_id);
CREATE INDEX IF NOT EXISTS payment_webhooks_provider_idx ON payment_webhooks(provider);

CREATE TABLE IF NOT EXISTS payment_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid REFERENCES payments(id) ON DELETE CASCADE,
    action text NOT NULL,
    actor text NOT NULL,
    detail text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_audit_logs_payment_idx ON payment_audit_logs(payment_id);
CREATE INDEX IF NOT EXISTS payment_audit_logs_action_idx ON payment_audit_logs(action);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS payment_audit_logs;
DROP TABLE IF EXISTS payment_webhooks;
DROP TABLE IF EXISTS payments;
-- +goose StatementEnd
