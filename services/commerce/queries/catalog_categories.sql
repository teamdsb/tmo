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

-- name: GetCategory :one
SELECT id, name, parent_id, sort, created_at, updated_at
FROM catalog_categories
WHERE id = $1;

-- name: ListCategories :many
SELECT id, name, parent_id, sort, created_at, updated_at
FROM catalog_categories
ORDER BY sort ASC, name ASC;

-- name: UpdateCategory :one
UPDATE catalog_categories
SET name = COALESCE(sqlc.narg('name')::text, name),
    parent_id = CASE
        WHEN sqlc.arg('parent_id_set')::boolean THEN sqlc.narg('parent_id')::uuid
        ELSE parent_id
    END,
    sort = COALESCE(sqlc.narg('sort')::integer, sort),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING id, name, parent_id, sort, created_at, updated_at;

-- name: DeleteCategory :execrows
DELETE FROM catalog_categories
WHERE id = $1;
