-- +goose Up
-- +goose StatementBegin
ALTER TABLE user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check,
  ADD CONSTRAINT user_roles_role_check CHECK (role IN ('CUSTOMER', 'SALES', 'PROCUREMENT', 'CS', 'ADMIN', 'BOSS', 'MANAGER'));

INSERT INTO roles (code, user_type, description) VALUES
  ('BOSS', 'admin', 'Business owner with full admin access'),
  ('MANAGER', 'staff', 'Operations manager with delegated staff/customer control')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, description) VALUES
  ('staff:read', 'Read staff users'),
  ('staff:status_manage', 'Manage staff account status')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, scope)
SELECT 'BOSS', code, 'ALL' FROM permissions
ON CONFLICT (role_code, permission_code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, scope) VALUES
  ('MANAGER', 'catalog:read', 'ALL'),
  ('MANAGER', 'order:read', 'ALL'),
  ('MANAGER', 'tracking:read', 'ALL'),
  ('MANAGER', 'inquiry:manage', 'ALL'),
  ('MANAGER', 'product_request:read', 'ALL'),
  ('MANAGER', 'after_sales:manage', 'ALL'),
  ('MANAGER', 'customer:read', 'ALL'),
  ('MANAGER', 'customer:transfer', 'ALL'),
  ('MANAGER', 'staff:read', 'ALL'),
  ('MANAGER', 'staff:status_manage', 'ALL')
ON CONFLICT (role_code, permission_code) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM role_permissions WHERE role_code = 'MANAGER';
DELETE FROM role_permissions WHERE role_code = 'BOSS';

DELETE FROM roles WHERE code IN ('MANAGER', 'BOSS');

DELETE FROM permissions WHERE code IN ('staff:read', 'staff:status_manage');

ALTER TABLE user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check,
  ADD CONSTRAINT user_roles_role_check CHECK (role IN ('CUSTOMER', 'SALES', 'PROCUREMENT', 'CS', 'ADMIN'));
-- +goose StatementEnd
