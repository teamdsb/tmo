-- +goose Up
ALTER TABLE product_export_jobs ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE product_export_jobs DROP COLUMN IF EXISTS needs_review;
