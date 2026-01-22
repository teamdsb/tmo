-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS order_tracking_shipments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    waybill_no text NOT NULL,
    carrier text,
    shipped_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (order_id, waybill_no)
);

CREATE INDEX IF NOT EXISTS order_tracking_shipments_order_idx ON order_tracking_shipments(order_id);

CREATE TABLE IF NOT EXISTS import_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL,
    status text NOT NULL,
    progress integer NOT NULL DEFAULT 0,
    result_file_url text,
    error_report_url text,
    created_by_user_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS import_jobs;
DROP TABLE IF EXISTS order_tracking_shipments;
-- +goose StatementEnd
