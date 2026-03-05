-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS miniapp_display_categories (
    id text PRIMARY KEY,
    name text NOT NULL,
    icon_key text NOT NULL DEFAULT 'apps',
    sort integer NOT NULL DEFAULT 0,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_miniapp_display_categories_sort
    ON miniapp_display_categories (sort ASC, id ASC);

INSERT INTO miniapp_display_categories (id, name, icon_key, sort, enabled)
VALUES
    ('cat-fasteners', '紧固件', 'setting', 1, true),
    ('cat-electrical', '电气', 'desktop', 2, true),
    ('cat-ppe', '安全防护', 'shield', 3, true)
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    icon_key = EXCLUDED.icon_key,
    sort = EXCLUDED.sort,
    enabled = EXCLUDED.enabled,
    updated_at = now();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_miniapp_display_categories_sort;
DROP TABLE IF EXISTS miniapp_display_categories;
-- +goose StatementEnd
