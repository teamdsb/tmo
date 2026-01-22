-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS cart_import_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL,
    status text NOT NULL,
    progress integer NOT NULL DEFAULT 0,
    auto_added_count integer NOT NULL DEFAULT 0,
    pending_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_import_rows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES cart_import_jobs(id) ON DELETE CASCADE,
    row_no integer NOT NULL,
    raw_name text NOT NULL,
    raw_spec text,
    raw_qty text,
    match_type text NOT NULL,
    sku_id uuid,
    qty integer,
    candidate_sku_ids uuid[] NOT NULL DEFAULT '{}',
    selected_sku_id uuid,
    selected_qty integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (match_type IN ('AUTO', 'AMBIGUOUS', 'NOT_FOUND'))
);

CREATE INDEX IF NOT EXISTS cart_import_rows_job_idx ON cart_import_rows(job_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS cart_import_rows;
DROP TABLE IF EXISTS cart_import_jobs;
-- +goose StatementEnd
