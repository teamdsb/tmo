-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tags_name_unique ON customer_tags (lower(name));
CREATE INDEX IF NOT EXISTS idx_customer_tags_active_sort ON customer_tags (active, sort, created_at);

CREATE TABLE IF NOT EXISTS customer_tag_bindings (
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_tag_bindings_tag_id ON customer_tag_bindings (tag_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_bindings_customer_id ON customer_tag_bindings (customer_id);

INSERT INTO permissions (code, description) VALUES
  ('customer:tag', 'Manage customer tags')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, scope) VALUES
  ('ADMIN', 'customer:tag', 'ALL'),
  ('BOSS', 'customer:tag', 'ALL'),
  ('MANAGER', 'customer:tag', 'ALL')
ON CONFLICT (role_code, permission_code) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM role_permissions WHERE permission_code = 'customer:tag';
DELETE FROM permissions WHERE code = 'customer:tag';

DROP INDEX IF EXISTS idx_customer_tag_bindings_customer_id;
DROP INDEX IF EXISTS idx_customer_tag_bindings_tag_id;
DROP TABLE IF EXISTS customer_tag_bindings;

DROP INDEX IF EXISTS idx_customer_tags_active_sort;
DROP INDEX IF EXISTS idx_customer_tags_name_unique;
DROP TABLE IF EXISTS customer_tags;
-- +goose StatementEnd
