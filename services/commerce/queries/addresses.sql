-- name: ListUserAddresses :many
SELECT id, user_id, receiver_name, receiver_phone, detail, is_default, created_at, updated_at
FROM user_addresses
WHERE user_id = $1
ORDER BY is_default DESC, created_at DESC;

-- name: CountUserAddresses :one
SELECT count(*)
FROM user_addresses
WHERE user_id = $1;

-- name: CreateUserAddress :one
INSERT INTO user_addresses (
    user_id,
    receiver_name,
    receiver_phone,
    detail,
    is_default
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
)
RETURNING id, user_id, receiver_name, receiver_phone, detail, is_default, created_at, updated_at;

-- name: GetUserAddress :one
SELECT id, user_id, receiver_name, receiver_phone, detail, is_default, created_at, updated_at
FROM user_addresses
WHERE id = $1
  AND user_id = $2;

-- name: ClearUserDefaultAddresses :exec
UPDATE user_addresses
SET is_default = false,
    updated_at = now()
WHERE user_id = $1
  AND is_default = true;

-- name: UpdateUserAddress :one
UPDATE user_addresses
SET receiver_name = COALESCE(sqlc.narg('receiver_name'), receiver_name),
    receiver_phone = COALESCE(sqlc.narg('receiver_phone'), receiver_phone),
    detail = COALESCE(sqlc.narg('detail'), detail),
    is_default = COALESCE(sqlc.narg('is_default'), is_default),
    updated_at = now()
WHERE id = sqlc.arg('id')
  AND user_id = sqlc.arg('user_id')
RETURNING id, user_id, receiver_name, receiver_phone, detail, is_default, created_at, updated_at;

-- name: DeleteUserAddress :one
DELETE FROM user_addresses
WHERE id = $1
  AND user_id = $2
RETURNING id, user_id, receiver_name, receiver_phone, detail, is_default, created_at, updated_at;

-- name: GetLatestUserAddress :one
SELECT id, user_id, receiver_name, receiver_phone, detail, is_default, created_at, updated_at
FROM user_addresses
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 1;

-- name: SetUserAddressDefault :one
UPDATE user_addresses
SET is_default = $3,
    updated_at = now()
WHERE id = $1
  AND user_id = $2
RETURNING id, user_id, receiver_name, receiver_phone, detail, is_default, created_at, updated_at;
