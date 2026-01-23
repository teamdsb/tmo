-- +goose Up
-- +goose StatementBegin
ALTER TABLE IF EXISTS catalog_skus
    ADD COLUMN IF NOT EXISTS spec text;

CREATE INDEX IF NOT EXISTS catalog_skus_name_spec_idx ON catalog_skus(name, spec);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'catalog_price_tiers'
          AND column_name = 'unit_price'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'catalog_price_tiers'
          AND column_name = 'unit_price_fen'
    ) THEN
        ALTER TABLE catalog_price_tiers
            RENAME COLUMN unit_price TO unit_price_fen;
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'catalog_price_tiers'
          AND column_name = 'unit_price_fen'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'catalog_price_tiers'
          AND column_name = 'unit_price'
    ) THEN
        ALTER TABLE catalog_price_tiers
            RENAME COLUMN unit_price_fen TO unit_price;
    END IF;
END $$;

DROP INDEX IF EXISTS catalog_skus_name_spec_idx;

ALTER TABLE IF EXISTS catalog_skus
    DROP COLUMN IF EXISTS spec;
-- +goose StatementEnd
