-- name: UpsertCartItem :one
INSERT INTO cart_items (
    owner_user_id,
    sku_id,
    qty
) VALUES (
    $1,
    $2,
    $3
)
ON CONFLICT (owner_user_id, sku_id)
DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty, updated_at = now()
RETURNING id, owner_user_id, sku_id, qty, created_at, updated_at;

-- name: ListCartItems :many
SELECT id, owner_user_id, sku_id, qty, created_at, updated_at
FROM cart_items
WHERE owner_user_id = $1
ORDER BY created_at ASC;

-- name: UpdateCartItemQty :one
UPDATE cart_items
SET qty = $2, updated_at = now()
WHERE id = $1 AND owner_user_id = $3
RETURNING id, owner_user_id, sku_id, qty, created_at, updated_at;

-- name: DeleteCartItem :exec
DELETE FROM cart_items
WHERE id = $1 AND owner_user_id = $2;
