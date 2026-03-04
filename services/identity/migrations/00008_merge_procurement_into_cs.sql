-- +goose Up
-- +goose StatementBegin
INSERT INTO role_permissions (role_code, permission_code, scope)
SELECT 'CS', permission_code, scope
FROM role_permissions
WHERE role_code = 'PROCUREMENT'
ON CONFLICT (role_code, permission_code) DO UPDATE
SET scope = CASE
  WHEN role_permissions.scope = 'ALL' OR EXCLUDED.scope = 'ALL' THEN 'ALL'
  WHEN role_permissions.scope = 'OWNED' OR EXCLUDED.scope = 'OWNED' THEN 'OWNED'
  ELSE 'SELF'
END;

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'CS'
FROM user_roles
WHERE role = 'PROCUREMENT'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM user_roles
WHERE role = 'PROCUREMENT';

UPDATE staff_phone_whitelist
SET roles = (
  SELECT array_agg(role ORDER BY role)
  FROM (
    SELECT DISTINCT
      CASE WHEN role = 'PROCUREMENT' THEN 'CS' ELSE role END AS role
    FROM unnest(staff_phone_whitelist.roles) AS role
  ) normalized
),
updated_at = now()
WHERE roles && ARRAY['PROCUREMENT']::text[];

DELETE FROM roles
WHERE code = 'PROCUREMENT';

ALTER TABLE user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check,
  ADD CONSTRAINT user_roles_role_check CHECK (role IN ('CUSTOMER', 'SALES', 'CS', 'ADMIN', 'BOSS', 'MANAGER'));

ALTER TABLE staff_phone_whitelist
  DROP CONSTRAINT IF EXISTS staff_phone_whitelist_roles_check,
  ADD CONSTRAINT staff_phone_whitelist_roles_check CHECK (roles <@ ARRAY['SALES', 'CS']::text[]);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
INSERT INTO roles (code, user_type, description)
VALUES ('PROCUREMENT', 'staff', 'Procurement staff')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code, scope) VALUES
  ('PROCUREMENT', 'order:read', 'ALL'),
  ('PROCUREMENT', 'tracking:read', 'ALL'),
  ('PROCUREMENT', 'import:shipment', 'ALL'),
  ('PROCUREMENT', 'shipment:manage', 'ALL')
ON CONFLICT (role_code, permission_code) DO NOTHING;

ALTER TABLE user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check,
  ADD CONSTRAINT user_roles_role_check CHECK (role IN ('CUSTOMER', 'SALES', 'PROCUREMENT', 'CS', 'ADMIN', 'BOSS', 'MANAGER'));

ALTER TABLE staff_phone_whitelist
  DROP CONSTRAINT IF EXISTS staff_phone_whitelist_roles_check,
  ADD CONSTRAINT staff_phone_whitelist_roles_check CHECK (roles <@ ARRAY['SALES', 'PROCUREMENT', 'CS']::text[]);
-- +goose StatementEnd
