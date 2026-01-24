-- name: CreateUser :one
INSERT INTO users (id, display_name, user_type, owner_sales_user_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateUserProfile :one
UPDATE users
SET display_name = COALESCE(sqlc.narg('display_name'), display_name),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateUserStatus :one
UPDATE users
SET status = $2,
    disabled_at = $3,
    disabled_reason = $4,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByIdentity :one
SELECT u.* FROM users u
JOIN user_identities i ON i.user_id = u.id
WHERE i.provider = $1 AND i.provider_user_id = $2
LIMIT 1;

-- name: GetUserIdentity :one
SELECT * FROM user_identities
WHERE provider = $1 AND provider_user_id = $2
LIMIT 1;

-- name: BindOwnerSalesUser :one
UPDATE users
SET owner_sales_user_id = $2, updated_at = now()
WHERE id = $1 AND owner_sales_user_id IS NULL
RETURNING *;

-- name: ListStaffUsers :many
SELECT * FROM users
WHERE user_type = 'staff'
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountStaffUsers :one
SELECT count(*) FROM users WHERE user_type = 'staff';

-- name: ListUserRoles :many
SELECT role FROM user_roles WHERE user_id = $1 ORDER BY role;

-- name: DeleteUserRoles :exec
DELETE FROM user_roles WHERE user_id = $1;

-- name: AddUserRole :exec
INSERT INTO user_roles (user_id, role)
VALUES ($1, $2)
ON CONFLICT (user_id, role) DO NOTHING;

-- name: CreateUserIdentity :one
INSERT INTO user_identities (id, provider, provider_user_id, provider_union_id, user_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetUserPasswordByUsername :one
SELECT user_id, password_hash FROM user_passwords WHERE username = $1;

-- name: UpsertUserPassword :exec
INSERT INTO user_passwords (user_id, username, password_hash)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE
SET username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    updated_at = now();

-- name: CreateSalesQrCode :exec
INSERT INTO sales_qr_codes (scene, sales_user_id, platform, qr_code_url, expires_at)
VALUES ($1, $2, $3, $4, $5);

-- name: UpdateSalesQrCode :exec
UPDATE sales_qr_codes
SET qr_code_url = $2,
    expires_at = $3,
    updated_at = now()
WHERE scene = $1;

-- name: GetSalesQrCode :one
SELECT * FROM sales_qr_codes WHERE scene = $1;

-- name: GetLatestSalesQrCode :one
SELECT * FROM sales_qr_codes
WHERE sales_user_id = $1 AND platform = $2 AND (expires_at IS NULL OR expires_at > now())
ORDER BY created_at DESC
LIMIT 1;

-- name: CreateStaffBindingToken :one
INSERT INTO staff_binding_tokens (token, staff_user_id, platform, expires_at, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetStaffBindingToken :one
SELECT * FROM staff_binding_tokens
WHERE token = $1
LIMIT 1;

-- name: MarkStaffBindingTokenUsed :exec
UPDATE staff_binding_tokens
SET used_at = now()
WHERE token = $1;

-- name: ListRoles :many
SELECT * FROM roles ORDER BY code;

-- name: ListPermissions :many
SELECT * FROM permissions ORDER BY code;

-- name: GetRole :one
SELECT * FROM roles WHERE code = $1;

-- name: GetPermission :one
SELECT * FROM permissions WHERE code = $1;

-- name: UpsertPermission :one
INSERT INTO permissions (code, description)
VALUES ($1, $2)
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description
RETURNING *;

-- name: DeleteRolePermissions :exec
DELETE FROM role_permissions WHERE role_code = $1;

-- name: AddRolePermission :exec
INSERT INTO role_permissions (role_code, permission_code, scope)
VALUES ($1, $2, $3)
ON CONFLICT (role_code, permission_code) DO UPDATE
SET scope = EXCLUDED.scope;

-- name: ListRolePermissions :many
SELECT permission_code, scope FROM role_permissions WHERE role_code = $1 ORDER BY permission_code;

-- name: ListEffectivePermissions :many
SELECT permission_code,
  CASE MAX(
    CASE scope
      WHEN 'SELF' THEN 1
      WHEN 'OWNED' THEN 2
      WHEN 'ALL' THEN 3
      ELSE 0
    END
  )
    WHEN 3 THEN 'ALL'
    WHEN 2 THEN 'OWNED'
    WHEN 1 THEN 'SELF'
    ELSE 'SELF'
  END AS scope
FROM role_permissions rp
JOIN user_roles ur ON ur.role = rp.role_code
WHERE ur.user_id = $1
GROUP BY permission_code
ORDER BY permission_code;

-- name: CreateAuditLog :one
INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, request_id, ip, user_agent)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListAuditLogs :many
SELECT * FROM audit_logs
WHERE (sqlc.narg('actor_user_id')::uuid IS NULL OR actor_user_id = sqlc.narg('actor_user_id'))
  AND (sqlc.narg('action')::text IS NULL OR action = sqlc.narg('action'))
  AND (sqlc.narg('target_type')::text IS NULL OR target_type = sqlc.narg('target_type'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountAuditLogs :one
SELECT count(*)
FROM audit_logs
WHERE (sqlc.narg('actor_user_id')::uuid IS NULL OR actor_user_id = sqlc.narg('actor_user_id'))
  AND (sqlc.narg('action')::text IS NULL OR action = sqlc.narg('action'))
  AND (sqlc.narg('target_type')::text IS NULL OR target_type = sqlc.narg('target_type'));
