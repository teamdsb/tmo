-- name: CreateCategory :one
INSERT INTO catalog_categories (
    name,
    parent_id,
    sort
) VALUES (
    $1,
    $2,
    $3
)
RETURNING id, name, parent_id, sort, created_at, updated_at;

-- name: ListCategories :many
SELECT id, name, parent_id, sort, created_at, updated_at
FROM catalog_categories
ORDER BY sort ASC, name ASC;
