-- name: CreateProduct :one
INSERT INTO catalog_products (
    name,
    description,
    category_id,
    cover_image_url,
    images,
    tags,
    filter_dimensions,
    status
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
)
RETURNING id, name, description, category_id, cover_image_url, images, tags, filter_dimensions, created_at, updated_at, status;

-- name: GetProduct :one
SELECT id, name, description, category_id, cover_image_url, images, tags, filter_dimensions, created_at, updated_at, status
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
    status = $9,
    updated_at = now()
WHERE id = $1
RETURNING id, name, description, category_id, cover_image_url, images, tags, filter_dimensions, created_at, updated_at, status;

-- name: DeleteProduct :one
WITH target_skus AS (
    SELECT id
    FROM catalog_skus
    WHERE product_id = $1
),
deleted_cart_items AS (
    DELETE FROM cart_items
    WHERE sku_id IN (SELECT id FROM target_skus)
),
deleted_wishlist_items AS (
    DELETE FROM wishlist_items
    WHERE sku_id IN (SELECT id FROM target_skus)
),
deleted_product AS (
    DELETE FROM catalog_products
    WHERE id = $1
    RETURNING 1
)
SELECT count(*)::bigint
FROM deleted_product;

-- name: ListProducts :many
SELECT id, name, description, category_id, cover_image_url, images, tags, filter_dimensions, created_at, updated_at, status
FROM catalog_products
WHERE (sqlc.narg('q')::text IS NULL OR name ILIKE '%' || sqlc.narg('q') || '%')
  AND (sqlc.narg('category_id')::uuid IS NULL OR category_id = sqlc.narg('category_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountProducts :one
SELECT count(*)
FROM catalog_products
WHERE (sqlc.narg('q')::text IS NULL OR name ILIKE '%' || sqlc.narg('q') || '%')
  AND (sqlc.narg('category_id')::uuid IS NULL OR category_id = sqlc.narg('category_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'));
