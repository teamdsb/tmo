-- +goose Up
-- +goose StatementBegin
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS source_cart_item_id uuid;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE order_items
    DROP COLUMN IF EXISTS source_cart_item_id;
-- +goose StatementEnd
