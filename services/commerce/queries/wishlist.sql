-- name: ListWishlistItems :many
SELECT id, owner_user_id, sku_id, created_at
FROM wishlist_items
WHERE owner_user_id = $1
ORDER BY created_at DESC;

-- name: CreateWishlistItem :exec
INSERT INTO wishlist_items (
    owner_user_id,
    sku_id
) VALUES (
    $1,
    $2
)
ON CONFLICT DO NOTHING;

-- name: DeleteWishlistItem :exec
DELETE FROM wishlist_items
WHERE owner_user_id = $1 AND sku_id = $2;
