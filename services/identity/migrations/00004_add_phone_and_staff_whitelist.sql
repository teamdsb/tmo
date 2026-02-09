-- +goose Up
-- +goose StatementBegin
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
  ON users (phone)
  WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS staff_phone_whitelist (
  phone text PRIMARY KEY,
  roles text[] NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_phone_whitelist_roles_not_empty CHECK (cardinality(roles) > 0),
  CONSTRAINT staff_phone_whitelist_roles_check CHECK (roles <@ ARRAY['SALES', 'PROCUREMENT', 'CS']::text[])
);

CREATE INDEX IF NOT EXISTS idx_staff_phone_whitelist_enabled ON staff_phone_whitelist (enabled);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_staff_phone_whitelist_enabled;
DROP TABLE IF EXISTS staff_phone_whitelist;

DROP INDEX IF EXISTS idx_users_phone_unique;

ALTER TABLE users
  DROP COLUMN IF EXISTS phone;
-- +goose StatementEnd
