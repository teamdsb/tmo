-- +goose Up
-- +goose StatementBegin
INSERT INTO permissions (code, description) VALUES
  ('order:manage', 'Confirm payment and assign orders')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, scope) VALUES
  ('BOSS', 'order:manage', 'ALL'),
  ('MANAGER', 'order:manage', 'ALL'),
  ('ADMIN', 'order:manage', 'ALL')
ON CONFLICT (role_code, permission_code) DO UPDATE SET scope = EXCLUDED.scope;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM role_permissions WHERE permission_code = 'order:manage';
DELETE FROM permissions WHERE code = 'order:manage';
-- +goose StatementEnd
