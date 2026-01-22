-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS catalog_skus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
    sku_code text,
    name text NOT NULL,
    spec text,
    attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
    unit text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_skus_code_idx ON catalog_skus(sku_code) WHERE sku_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS catalog_skus_product_idx ON catalog_skus(product_id);
CREATE INDEX IF NOT EXISTS catalog_skus_name_spec_idx ON catalog_skus(name, spec);

CREATE TABLE IF NOT EXISTS catalog_price_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id uuid NOT NULL REFERENCES catalog_skus(id) ON DELETE CASCADE,
    min_qty integer NOT NULL,
    max_qty integer,
    unit_price_fen bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_price_tiers_sku_idx ON catalog_price_tiers(sku_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS catalog_price_tiers;
DROP TABLE IF EXISTS catalog_skus;
-- +goose StatementEnd
