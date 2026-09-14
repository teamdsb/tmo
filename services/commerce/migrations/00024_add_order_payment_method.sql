-- +goose Up
-- +goose StatementBegin
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_method text;

UPDATE orders
SET payment_method = CASE
    WHEN upper(coalesce(payment_channel, '')) = 'OFFLINE' THEN 'OFFLINE'
    WHEN latest_payment_id IS NOT NULL
      OR upper(coalesce(payment_channel, '')) IN ('WECHAT', 'ALIPAY') THEN 'ONLINE'
    ELSE 'OFFLINE'
END;

ALTER TABLE orders
    ALTER COLUMN payment_method SET NOT NULL,
    ADD CONSTRAINT orders_payment_method_check
        CHECK (payment_method IN ('ONLINE', 'OFFLINE'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_payment_method_check,
    DROP COLUMN IF EXISTS payment_method;
-- +goose StatementEnd
