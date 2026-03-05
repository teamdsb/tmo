-- name: CreateUser :one
INSERT INTO users (id, display_name, phone, user_type, owner_sales_user_id)
VALUES ($1, $2, $3, $4, $5)
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

-- name: GetUserByPhone :one
SELECT * FROM users
WHERE phone = $1
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

-- name: BindUserPhone :one
UPDATE users
SET phone = $2,
    updated_at = now()
WHERE id = $1
  AND (phone IS NULL OR phone = $2)
RETURNING *;

-- name: ListStaffUsers :many
SELECT * FROM users
WHERE user_type = 'staff'
  AND (
    sqlc.narg('q')::text IS NULL
    OR COALESCE(display_name, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR id::text ILIKE '%' || sqlc.narg('q') || '%'
    OR EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = users.id
        AND ur.role ILIKE '%' || sqlc.narg('q') || '%'
    )
  )
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountStaffUsers :one
SELECT count(*)
FROM users
WHERE user_type = 'staff'
  AND (
    sqlc.narg('q')::text IS NULL
    OR COALESCE(display_name, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR id::text ILIKE '%' || sqlc.narg('q') || '%'
    OR EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = users.id
        AND ur.role ILIKE '%' || sqlc.narg('q') || '%'
    )
  );

-- name: ListCustomers :many
SELECT * FROM users
WHERE user_type = 'customer'
  AND (
    sqlc.narg('q')::text IS NULL
    OR COALESCE(display_name, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(phone, '') ILIKE '%' || sqlc.narg('q') || '%'
  )
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (sqlc.narg('customer_id')::uuid IS NULL OR id = sqlc.narg('customer_id'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountCustomers :one
SELECT count(*)
FROM users
WHERE user_type = 'customer'
  AND (
    sqlc.narg('q')::text IS NULL
    OR COALESCE(display_name, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(phone, '') ILIKE '%' || sqlc.narg('q') || '%'
  )
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (sqlc.narg('customer_id')::uuid IS NULL OR id = sqlc.narg('customer_id'));

-- name: GetCustomerByID :one
SELECT * FROM users
WHERE id = $1 AND user_type = 'customer';

-- name: GetCustomerFinanceProfile :one
SELECT id, payment_term_type, payment_term_days, payment_term_custom_label, payment_term_remark, updated_at
FROM users
WHERE id = $1 AND user_type = 'customer';

-- name: UpdateCustomerFinanceProfile :one
UPDATE users
SET payment_term_type = $2,
    payment_term_days = $3,
    payment_term_custom_label = $4,
    payment_term_remark = $5,
    updated_at = now()
WHERE id = $1 AND user_type = 'customer'
RETURNING id, payment_term_type, payment_term_days, payment_term_custom_label, payment_term_remark, updated_at;

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

-- name: GetFeatureFlags :one
SELECT payment_enabled, wechat_pay_enabled, alipay_pay_enabled
FROM feature_flags
WHERE id = 1;

-- name: UpdateFeatureFlags :one
UPDATE feature_flags
SET payment_enabled = $1,
    wechat_pay_enabled = $2,
    alipay_pay_enabled = $3,
    updated_at = now()
WHERE id = 1
RETURNING payment_enabled, wechat_pay_enabled, alipay_pay_enabled;

-- name: TransferCustomerOwnership :one
UPDATE users
SET owner_sales_user_id = $2,
    updated_at = now()
WHERE id = $1 AND user_type = 'customer'
RETURNING *;

-- name: CountCustomersByIDs :one
SELECT count(*)
FROM users
WHERE user_type = 'customer'
  AND id = ANY(sqlc.arg('customer_ids')::uuid[]);

-- name: CountCustomersOwnedBySalesInIDs :one
SELECT count(*)
FROM users
WHERE user_type = 'customer'
  AND id = ANY(sqlc.arg('customer_ids')::uuid[])
  AND owner_sales_user_id = sqlc.arg('owner_sales_user_id')::uuid;

-- name: TransferCustomersOwnership :many
UPDATE users
SET owner_sales_user_id = sqlc.arg('owner_sales_user_id')::uuid,
    updated_at = now()
WHERE user_type = 'customer'
  AND id = ANY(sqlc.arg('customer_ids')::uuid[])
RETURNING *;

-- name: GetActiveSalesUserByID :one
SELECT DISTINCT u.*
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
WHERE u.id = $1
  AND u.user_type = 'staff'
  AND u.status = 'active'
  AND ur.role = 'SALES'
LIMIT 1;

-- name: ListActiveSalesUsers :many
SELECT DISTINCT u.*
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
WHERE u.user_type = 'staff'
  AND u.status = 'active'
  AND ur.role = 'SALES'
  AND (
    sqlc.narg('q')::text IS NULL
    OR COALESCE(u.display_name, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(u.phone, '') ILIKE '%' || sqlc.narg('q') || '%'
  )
ORDER BY u.created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountActiveSalesUsers :one
SELECT count(*)
FROM (
  SELECT u.id
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  WHERE u.user_type = 'staff'
    AND u.status = 'active'
    AND ur.role = 'SALES'
    AND (
      sqlc.narg('q')::text IS NULL
      OR COALESCE(u.display_name, '') ILIKE '%' || sqlc.narg('q') || '%'
      OR COALESCE(u.phone, '') ILIKE '%' || sqlc.narg('q') || '%'
    )
  GROUP BY u.id
) AS filtered_sales;

-- name: ListAdminUsers :many
SELECT DISTINCT u.*
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
WHERE u.user_type IN ('admin', 'staff')
  AND (
    sqlc.narg('q')::text IS NULL
    OR COALESCE(u.display_name, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(u.phone, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR u.id::text ILIKE '%' || sqlc.narg('q') || '%'
  )
  AND (sqlc.narg('status')::text IS NULL OR u.status = sqlc.narg('status'))
  AND (sqlc.narg('role')::text IS NULL OR ur.role = sqlc.narg('role'))
ORDER BY u.created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountAdminUsers :one
SELECT count(*)
FROM (
  SELECT u.id
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  WHERE u.user_type IN ('admin', 'staff')
    AND (
      sqlc.narg('q')::text IS NULL
      OR COALESCE(u.display_name, '') ILIKE '%' || sqlc.narg('q') || '%'
      OR COALESCE(u.phone, '') ILIKE '%' || sqlc.narg('q') || '%'
      OR u.id::text ILIKE '%' || sqlc.narg('q') || '%'
    )
    AND (sqlc.narg('status')::text IS NULL OR u.status = sqlc.narg('status'))
    AND (sqlc.narg('role')::text IS NULL OR ur.role = sqlc.narg('role'))
  GROUP BY u.id
) AS filtered_admin_users;

-- name: PromoteCustomerToStaff :one
UPDATE users
SET user_type = 'staff',
    owner_sales_user_id = NULL,
    status = 'active',
    disabled_at = NULL,
    disabled_reason = NULL,
    updated_at = now()
WHERE id = $1 AND user_type = 'customer'
RETURNING *;

-- name: ListAdminCustomers :many
SELECT u.*
FROM users u
WHERE u.user_type = 'customer'
  AND (
    sqlc.narg('q')::text IS NULL
    OR COALESCE(u.display_name, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(u.phone, '') ILIKE '%' || sqlc.narg('q') || '%'
  )
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR u.owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (
    NOT sqlc.arg('filter_by_tags')::boolean
    OR EXISTS (
      SELECT 1
      FROM customer_tag_bindings ctb
      WHERE ctb.customer_id = u.id
        AND ctb.tag_id = ANY(sqlc.arg('tag_ids')::uuid[])
    )
  )
ORDER BY u.created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountAdminCustomers :one
SELECT count(*)
FROM users u
WHERE u.user_type = 'customer'
  AND (
    sqlc.narg('q')::text IS NULL
    OR COALESCE(u.display_name, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(u.phone, '') ILIKE '%' || sqlc.narg('q') || '%'
  )
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR u.owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (
    NOT sqlc.arg('filter_by_tags')::boolean
    OR EXISTS (
      SELECT 1
      FROM customer_tag_bindings ctb
      WHERE ctb.customer_id = u.id
        AND ctb.tag_id = ANY(sqlc.arg('tag_ids')::uuid[])
    )
  );

-- name: ListUsersByIDs :many
SELECT *
FROM users
WHERE id = ANY(sqlc.arg('ids')::uuid[]);

-- name: ListCustomerTagsByCustomerIDs :many
SELECT
  ctb.customer_id,
  t.id AS tag_id,
  t.name AS tag_name,
  t.color AS tag_color,
  t.sort AS tag_sort,
  t.active AS tag_active
FROM customer_tag_bindings ctb
JOIN customer_tags t ON t.id = ctb.tag_id
WHERE ctb.customer_id = ANY(sqlc.arg('customer_ids')::uuid[])
ORDER BY t.sort ASC, t.created_at ASC;

-- name: CreateCustomerTag :one
INSERT INTO customer_tags (id, name, color, sort, active)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListCustomerTags :many
SELECT *
FROM customer_tags
WHERE sqlc.arg('include_inactive')::boolean OR active = true
ORDER BY sort ASC, created_at ASC;

-- name: GetCustomerTagByID :one
SELECT *
FROM customer_tags
WHERE id = $1
LIMIT 1;

-- name: ListCustomerTagsByIDs :many
SELECT *
FROM customer_tags
WHERE id = ANY(sqlc.arg('tag_ids')::uuid[]);

-- name: UpdateCustomerTag :one
UPDATE customer_tags
SET name = COALESCE(sqlc.narg('name'), name),
    color = COALESCE(sqlc.narg('color'), color),
    sort = COALESCE(sqlc.narg('sort'), sort),
    active = COALESCE(sqlc.narg('active'), active),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: AddCustomerTagBindings :exec
INSERT INTO customer_tag_bindings (customer_id, tag_id, created_by)
SELECT unnest(sqlc.arg('customer_ids')::uuid[]), sqlc.arg('tag_id')::uuid, sqlc.arg('created_by')::uuid
ON CONFLICT (customer_id, tag_id) DO NOTHING;

-- name: RemoveCustomerTagBindings :exec
DELETE FROM customer_tag_bindings
WHERE tag_id = sqlc.arg('tag_id')::uuid
  AND customer_id = ANY(sqlc.arg('customer_ids')::uuid[]);
