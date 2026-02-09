-- name: CreateProduct :one
INSERT INTO catalog_products (
    name,
    description,
    category_id,
    cover_image_url,
    images,
    tags,
    filter_dimensions
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7
)
RETURNING id, name, description, category_id, cover_image_url, images, tags, filter_dimensions, created_at, updated_at;

-- name: GetProduct :one
SELECT id, name, description, category_id, cover_image_url, images, tags, filter_dimensions, created_at, updated_at
FROM catalog_products
WHERE id = sqlc.arg('id');

-- name: UpdateProduct :one
UPDATE catalog_products
SET name = $2,
    description = $3,
    category_id = $4,
    cover_image_url = $5,
    images = $6,
    tags = $7,
    filter_dimensions = $8,
    updated_at = now()
WHERE id = $1
RETURNING id, name, description, category_id, cover_image_url, images, tags, filter_dimensions, created_at, updated_at;

-- name: DeleteProduct :execrows
DELETE FROM catalog_products
WHERE id = $1;

-- name: ListProducts :many
SELECT id, name, description, category_id, cover_image_url, images, tags, filter_dimensions, created_at, updated_at
FROM catalog_products
WHERE (sqlc.narg('q')::text IS NULL OR name ILIKE '%' || sqlc.narg('q') || '%')
  AND (sqlc.narg('category_id')::uuid IS NULL OR category_id = sqlc.narg('category_id'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountProducts :one
SELECT count(*)
FROM catalog_products
WHERE (sqlc.narg('q')::text IS NULL OR name ILIKE '%' || sqlc.narg('q') || '%')
  AND (sqlc.narg('category_id')::uuid IS NULL OR category_id = sqlc.narg('category_id'));
