-- +goose Up
-- +goose StatementBegin
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_status_check,
  ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'disabled'));

ALTER TABLE user_identities
  ADD COLUMN IF NOT EXISTS provider_union_id text;

CREATE TABLE IF NOT EXISTS roles (
  code text PRIMARY KEY,
  user_type text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_user_type_check CHECK (user_type IN ('customer', 'staff', 'admin'))
);

CREATE TABLE IF NOT EXISTS permissions (
  code text PRIMARY KEY,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_code text NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_code, permission_code),
  CONSTRAINT role_permissions_scope_check CHECK (scope IN ('SELF', 'OWNED', 'ALL'))
);

CREATE TABLE IF NOT EXISTS staff_binding_tokens (
  token text PRIMARY KEY,
  staff_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  expires_at timestamptz,
  used_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_binding_tokens_platform_check CHECK (platform IN ('weapp', 'alipay'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb,
  request_id text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sales_qr_codes
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'weapp',
  ADD COLUMN IF NOT EXISTS qr_code_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE sales_qr_codes
  DROP CONSTRAINT IF EXISTS sales_qr_codes_platform_check,
  ADD CONSTRAINT sales_qr_codes_platform_check CHECK (platform IN ('weapp', 'alipay'));

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_code ON role_permissions (permission_code);
CREATE INDEX IF NOT EXISTS idx_staff_binding_tokens_staff_user_id ON staff_binding_tokens (staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_binding_tokens_expires_at ON staff_binding_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_sales_qr_codes_platform ON sales_qr_codes (platform);

INSERT INTO roles (code, user_type, description) VALUES
  ('CUSTOMER', 'customer', 'External customer'),
  ('SALES', 'staff', 'Sales staff'),
  ('PROCUREMENT', 'staff', 'Procurement staff'),
  ('CS', 'staff', 'Customer service'),
  ('ADMIN', 'admin', 'Administrator')
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_role_fkey'
  ) THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT user_roles_role_fkey FOREIGN KEY (role) REFERENCES roles(code) ON DELETE CASCADE;
  END IF;
END $$;

INSERT INTO permissions (code, description) VALUES
  ('catalog:read', 'Read catalog'),
  ('wishlist:manage', 'Manage wishlist'),
  ('cart:manage', 'Manage cart'),
  ('order:create', 'Create order'),
  ('order:read', 'Read orders'),
  ('tracking:read', 'Read tracking'),
  ('product_request:create', 'Create product requests'),
  ('product_request:read', 'Read product requests'),
  ('product_request:export', 'Export product requests'),
  ('after_sales:create', 'Create after-sales'),
  ('after_sales:read', 'Read after-sales'),
  ('after_sales:manage', 'Manage after-sales'),
  ('inquiry:create', 'Create inquiry'),
  ('inquiry:read', 'Read inquiry'),
  ('inquiry:manage', 'Manage inquiry'),
  ('customer:transfer', 'Transfer customer'),
  ('customer:read', 'Read customer'),
  ('product:manage', 'Manage product'),
  ('import:product', 'Import products'),
  ('import:shipment', 'Import shipments'),
  ('shipment:manage', 'Manage shipments'),
  ('import:cart', 'Import cart'),
  ('config:feature_flags', 'Manage feature flags'),
  ('payment:manage', 'Manage payments'),
  ('rbac:manage', 'Manage RBAC')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, scope)
SELECT 'ADMIN', code, 'ALL' FROM permissions
ON CONFLICT (role_code, permission_code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, scope) VALUES
  ('CUSTOMER', 'catalog:read', 'ALL'),
  ('CUSTOMER', 'wishlist:manage', 'SELF'),
  ('CUSTOMER', 'cart:manage', 'SELF'),
  ('CUSTOMER', 'import:cart', 'SELF'),
  ('CUSTOMER', 'order:create', 'SELF'),
  ('CUSTOMER', 'order:read', 'SELF'),
  ('CUSTOMER', 'tracking:read', 'SELF'),
  ('CUSTOMER', 'product_request:create', 'SELF'),
  ('CUSTOMER', 'product_request:read', 'SELF'),
  ('CUSTOMER', 'after_sales:create', 'SELF'),
  ('CUSTOMER', 'after_sales:read', 'SELF'),
  ('CUSTOMER', 'inquiry:create', 'SELF'),
  ('CUSTOMER', 'inquiry:read', 'SELF'),
  ('SALES', 'catalog:read', 'ALL'),
  ('SALES', 'order:read', 'OWNED'),
  ('SALES', 'tracking:read', 'OWNED'),
  ('SALES', 'inquiry:manage', 'OWNED'),
  ('SALES', 'product_request:read', 'OWNED'),
  ('SALES', 'after_sales:manage', 'OWNED'),
  ('SALES', 'customer:read', 'OWNED'),
  ('PROCUREMENT', 'order:read', 'ALL'),
  ('PROCUREMENT', 'tracking:read', 'ALL'),
  ('PROCUREMENT', 'import:shipment', 'ALL'),
  ('PROCUREMENT', 'shipment:manage', 'ALL'),
  ('CS', 'after_sales:manage', 'ALL'),
  ('CS', 'inquiry:manage', 'ALL'),
  ('CS', 'order:read', 'ALL'),
  ('CS', 'tracking:read', 'ALL'),
  ('CS', 'product_request:read', 'ALL')
ON CONFLICT (role_code, permission_code) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_fkey;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS staff_binding_tokens;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;

ALTER TABLE sales_qr_codes
  DROP COLUMN IF EXISTS platform,
  DROP COLUMN IF EXISTS qr_code_url,
  DROP COLUMN IF EXISTS updated_at;

ALTER TABLE user_identities
  DROP COLUMN IF EXISTS provider_union_id;

ALTER TABLE users
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS disabled_at,
  DROP COLUMN IF EXISTS disabled_reason;

DROP INDEX IF EXISTS idx_role_permissions_permission_code;
DROP INDEX IF EXISTS idx_staff_binding_tokens_staff_user_id;
DROP INDEX IF EXISTS idx_staff_binding_tokens_expires_at;
DROP INDEX IF EXISTS idx_audit_logs_actor_user_id;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_sales_qr_codes_platform;
-- +goose StatementEnd
