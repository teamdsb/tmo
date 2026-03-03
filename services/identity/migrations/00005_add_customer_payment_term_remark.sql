-- +goose Up
-- +goose StatementBegin
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_term_remark text;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE users
  DROP COLUMN IF EXISTS payment_term_remark;
-- +goose StatementEnd
