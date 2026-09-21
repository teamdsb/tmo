-- +goose Up
CREATE TABLE IF NOT EXISTS product_export_jobs (
    job_id uuid PRIMARY KEY REFERENCES import_jobs(id) ON DELETE CASCADE,
    query text,
    category_id uuid,
    product_status text,
    exported_rows integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS product_export_jobs;
