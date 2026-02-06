-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS feature_flags (
    id integer PRIMARY KEY DEFAULT 1,
    payment_enabled boolean NOT NULL DEFAULT false,
    wechat_pay_enabled boolean NOT NULL DEFAULT false,
    alipay_pay_enabled boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT feature_flags_singleton CHECK (id = 1)
);

INSERT INTO feature_flags (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS feature_flags;
-- +goose StatementEnd
