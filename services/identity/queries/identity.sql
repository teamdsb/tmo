-- name: CreateUser :one
INSERT INTO users (id, display_name, user_type, owner_sales_user_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByIdentity :one
SELECT u.* FROM users u
JOIN user_identities i ON i.user_id = u.id
WHERE i.provider = $1 AND i.provider_user_id = $2
LIMIT 1;

-- name: BindOwnerSalesUser :one
UPDATE users
SET owner_sales_user_id = $2, updated_at = now()
WHERE id = $1 AND owner_sales_user_id IS NULL
RETURNING *;

-- name: ListUserRoles :many
SELECT role FROM user_roles WHERE user_id = $1 ORDER BY role;

-- name: AddUserRole :exec
INSERT INTO user_roles (user_id, role)
VALUES ($1, $2)
ON CONFLICT (user_id, role) DO NOTHING;

-- name: UpsertUserIdentity :one
INSERT INTO user_identities (id, provider, provider_user_id, user_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (provider, provider_user_id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    updated_at = now()
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
INSERT INTO sales_qr_codes (scene, sales_user_id, expires_at)
VALUES ($1, $2, $3);

-- name: GetSalesQrCode :one
SELECT * FROM sales_qr_codes WHERE scene = $1;
