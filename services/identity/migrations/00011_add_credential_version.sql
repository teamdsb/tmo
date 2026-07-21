-- +goose Up
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS credential_version bigint NOT NULL DEFAULT 1;

-- +goose Down
ALTER TABLE users
  DROP COLUMN IF EXISTS credential_version;
