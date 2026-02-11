-- name: CreateProductRequest :one
INSERT INTO product_requests (
    created_by_user_id,
    owner_sales_user_id,
    name,
    category_id,
    spec,
    material,
    dimensions,
    color,
    qty,
    note,
    reference_image_urls
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11
)
RETURNING
    id,
    created_by_user_id,
    owner_sales_user_id,
    name,
    spec,
    qty,
    note,
    created_at,
    updated_at,
    category_id,
    material,
    dimensions,
    color,
    reference_image_urls;

-- name: ListProductRequests :many
SELECT
    id,
    created_by_user_id,
    owner_sales_user_id,
    name,
    spec,
    qty,
    note,
    created_at,
    updated_at,
    category_id,
    material,
    dimensions,
    color,
    reference_image_urls
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
