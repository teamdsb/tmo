-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS catalog_media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
    source_url text NOT NULL,
    storage_url text,
    content_sha256 text,
    status text NOT NULL,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (product_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_catalog_media_assets_status
    ON catalog_media_assets (status);

CREATE INDEX IF NOT EXISTS idx_catalog_media_assets_product_id
    ON catalog_media_assets (product_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS catalog_media_assets;
-- +goose StatementEnd
