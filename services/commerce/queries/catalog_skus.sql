-- name: CreateSku :one
INSERT INTO catalog_skus (
    product_id,
    sku_code,
    name,
    spec,
    attributes,
    unit,
    is_active
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7
)
RETURNING id, product_id, sku_code, name, spec, attributes, unit, is_active, created_at, updated_at;

-- name: UpdateSku :one
UPDATE catalog_skus
SET sku_code = $2,
    name = $3,
    spec = $4,
    attributes = $5,
    unit = $6,
    is_active = $7,
    updated_at = now()
WHERE id = $1
RETURNING id, product_id, sku_code, name, spec, attributes, unit, is_active, created_at, updated_at;

-- name: ListSkusByProduct :many
SELECT id, product_id, sku_code, name, spec, attributes, unit, is_active, created_at, updated_at
FROM catalog_skus
WHERE product_id = $1
ORDER BY created_at ASC;

-- name: ListSkusByIDs :many
SELECT id, product_id, sku_code, name, spec, attributes, unit, is_active, created_at, updated_at
FROM catalog_skus
WHERE id = ANY($1::uuid[]);

-- name: ListSkusBySkuCode :many
SELECT id, product_id, sku_code, name, spec, attributes, unit, is_active, created_at, updated_at
FROM catalog_skus
WHERE sku_code = $1;

-- name: ListSkusByName :many
SELECT id, product_id, sku_code, name, spec, attributes, unit, is_active, created_at, updated_at
FROM catalog_skus
WHERE name = $1;

-- name: ListSkusByNameAndSpec :many
SELECT id, product_id, sku_code, name, spec, attributes, unit, is_active, created_at, updated_at
FROM catalog_skus
WHERE name = sqlc.arg(name)
  AND spec = sqlc.arg(spec);
