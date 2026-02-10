-- +goose Up
-- +goose StatementBegin
ALTER TABLE product_requests
    ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES catalog_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS material text,
    ADD COLUMN IF NOT EXISTS dimensions text,
    ADD COLUMN IF NOT EXISTS color text,
    ADD COLUMN IF NOT EXISTS reference_image_urls text[] NOT NULL DEFAULT '{}'::text[];
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE product_requests
    DROP COLUMN IF EXISTS reference_image_urls,
    DROP COLUMN IF EXISTS color,
    DROP COLUMN IF EXISTS dimensions,
    DROP COLUMN IF EXISTS material,
    DROP COLUMN IF EXISTS category_id;
-- +goose StatementEnd
