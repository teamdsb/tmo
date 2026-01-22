-- name: CreatePriceTier :one
INSERT INTO catalog_price_tiers (
    sku_id,
    min_qty,
    max_qty,
    unit_price
) VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING id, sku_id, min_qty, max_qty, unit_price, created_at, updated_at;

-- name: ListPriceTiersBySku :many
SELECT id, sku_id, min_qty, max_qty, unit_price, created_at, updated_at
FROM catalog_price_tiers
WHERE sku_id = $1
ORDER BY min_qty ASC;

-- name: ListPriceTiersBySkus :many
SELECT id, sku_id, min_qty, max_qty, unit_price, created_at, updated_at
FROM catalog_price_tiers
WHERE sku_id = ANY($1::uuid[])
ORDER BY sku_id, min_qty ASC;
