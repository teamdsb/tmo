-- +goose Up
-- +goose StatementBegin
ALTER TABLE import_jobs
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_import_jobs_type_status_created_at
    ON import_jobs (type, status, created_at);

CREATE TABLE IF NOT EXISTS product_import_jobs (
    job_id uuid PRIMARY KEY REFERENCES import_jobs(id) ON DELETE CASCADE,
    excel_file_path text NOT NULL,
    excel_file_name text NOT NULL,
    images_zip_path text,
    images_zip_name text,
    image_base_url text,
    total_rows integer NOT NULL DEFAULT 0,
    success_rows integer NOT NULL DEFAULT 0,
    failed_rows integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_import_rows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES product_import_jobs(job_id) ON DELETE CASCADE,
    line_no integer NOT NULL,
    group_key text,
    sku_code text,
    product_name text,
    row_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL,
    error_message text,
    product_id uuid,
    sku_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_product_import_rows_job_status
    ON product_import_rows (job_id, status, line_no);

CREATE INDEX IF NOT EXISTS idx_product_import_rows_job_sku
    ON product_import_rows (job_id, sku_code);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS product_import_rows;
DROP TABLE IF EXISTS product_import_jobs;
DROP INDEX IF EXISTS idx_import_jobs_type_status_created_at;
ALTER TABLE import_jobs
    DROP COLUMN IF EXISTS updated_at;
-- +goose StatementEnd
