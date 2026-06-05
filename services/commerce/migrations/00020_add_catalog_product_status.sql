-- +goose Up
-- +goose StatementBegin
ALTER TABLE catalog_products
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'DRAFT';

ALTER TABLE catalog_products
    ADD CONSTRAINT catalog_products_status_check
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'DRAFT'));

CREATE INDEX IF NOT EXISTS idx_catalog_products_status_created_at
    ON catalog_products (status, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_catalog_products_status_created_at;

ALTER TABLE catalog_products
    DROP CONSTRAINT IF EXISTS catalog_products_status_check;

ALTER TABLE catalog_products
    DROP COLUMN IF EXISTS status;
-- +goose StatementEnd
