-- +goose Up
-- Legacy summaries have no trustworthy source timestamp/version. The first
-- versioned synchronization establishes ordering without guessing old history.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_sync_created_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_sync_state_version bigint NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE orders DROP COLUMN IF EXISTS payment_sync_state_version;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_sync_created_at;
