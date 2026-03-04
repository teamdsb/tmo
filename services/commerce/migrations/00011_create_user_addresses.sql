-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS user_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    receiver_name text NOT NULL,
    receiver_phone text NOT NULL,
    detail text NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_created_at
    ON user_addresses (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_addresses_user_default
    ON user_addresses (user_id)
    WHERE is_default = true;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS uq_user_addresses_user_default;
DROP INDEX IF EXISTS idx_user_addresses_user_created_at;
DROP TABLE IF EXISTS user_addresses;
-- +goose StatementEnd
