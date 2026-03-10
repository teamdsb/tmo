-- +goose Up
-- +goose StatementBegin
ALTER TABLE support_conversations
ADD COLUMN IF NOT EXISTS customer_display_name text,
ADD COLUMN IF NOT EXISTS customer_phone text;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE support_conversations
DROP COLUMN IF EXISTS customer_phone,
DROP COLUMN IF EXISTS customer_display_name;
-- +goose StatementEnd
