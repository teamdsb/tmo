-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS product_request_export_jobs (
    job_id uuid PRIMARY KEY REFERENCES import_jobs(id) ON DELETE CASCADE,
    created_after timestamptz,
    created_before timestamptz,
    exported_rows integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS product_request_export_jobs;
-- +goose StatementEnd
