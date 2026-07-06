-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS order_admin_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    idempotency_key text NOT NULL,
    actor_user_id uuid NOT NULL,
    action text NOT NULL,
    note text NOT NULL,
    previous_status text NOT NULL,
    new_status text NOT NULL,
    previous_payment_status text NOT NULL,
    new_payment_status text NOT NULL,
    previous_owner_sales_user_id uuid,
    new_owner_sales_user_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_admin_events_note_not_blank CHECK (length(btrim(note)) > 0),
    CONSTRAINT order_admin_events_order_idempotency_unique UNIQUE (order_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS order_admin_events_order_created_idx
    ON order_admin_events(order_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS order_admin_events;
-- +goose StatementEnd
