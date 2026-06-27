-- +goose Up
-- +goose StatementBegin
WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY sort ASC, created_at DESC, id ASC)::integer AS position
    FROM catalog_categories
)
UPDATE catalog_categories AS category
SET sort = ranked.position,
    updated_at = now()
FROM ranked
WHERE category.id = ranked.id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'catalog_categories_sort_positive'
          AND conrelid = 'catalog_categories'::regclass
    ) THEN
        ALTER TABLE catalog_categories
            ADD CONSTRAINT catalog_categories_sort_positive CHECK (sort > 0);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'catalog_categories_sort_unique'
          AND conrelid = 'catalog_categories'::regclass
    ) THEN
        ALTER TABLE catalog_categories
            ADD CONSTRAINT catalog_categories_sort_unique UNIQUE (sort) DEFERRABLE INITIALLY DEFERRED;
    END IF;
END
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE catalog_categories
    DROP CONSTRAINT IF EXISTS catalog_categories_sort_unique,
    DROP CONSTRAINT IF EXISTS catalog_categories_sort_positive;
-- +goose StatementEnd
