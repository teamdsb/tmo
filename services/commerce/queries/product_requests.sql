-- name: CreateProductRequest :one
INSERT INTO product_requests (
    created_by_user_id,
    owner_sales_user_id,
    name,
    spec,
    qty,
    note
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
RETURNING id, created_by_user_id, owner_sales_user_id, name, spec, qty, note, created_at, updated_at;

-- name: ListProductRequests :many
SELECT id, created_by_user_id, owner_sales_user_id, name, spec, qty, note, created_at, updated_at
FROM product_requests
WHERE (sqlc.narg('created_by_user_id')::uuid IS NULL OR created_by_user_id = sqlc.narg('created_by_user_id'))
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (sqlc.narg('created_after')::timestamptz IS NULL OR created_at >= sqlc.narg('created_after'))
  AND (sqlc.narg('created_before')::timestamptz IS NULL OR created_at <= sqlc.narg('created_before'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountProductRequests :one
SELECT count(*)
FROM product_requests
WHERE (sqlc.narg('created_by_user_id')::uuid IS NULL OR created_by_user_id = sqlc.narg('created_by_user_id'))
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (sqlc.narg('created_after')::timestamptz IS NULL OR created_at >= sqlc.narg('created_after'))
  AND (sqlc.narg('created_before')::timestamptz IS NULL OR created_at <= sqlc.narg('created_before'));
