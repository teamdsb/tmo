-- name: CreateCategory :one
WITH lock_category_sort AS MATERIALIZED (
    SELECT pg_advisory_xact_lock(1984052701)
), target_position AS MATERIALIZED (
    SELECT LEAST(GREATEST(sqlc.arg('sort')::integer, 1), count(*)::integer + 1) AS sort
    FROM catalog_categories
    CROSS JOIN lock_category_sort
), shifted AS (
    UPDATE catalog_categories AS category
    SET sort = category.sort + 1,
        updated_at = now()
    FROM target_position
    WHERE category.sort >= target_position.sort
    RETURNING category.id
)
INSERT INTO catalog_categories (
    name,
    parent_id,
    sort
) SELECT
    $1,
    $2,
    target_position.sort
FROM target_position
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
WITH lock_category_sort AS MATERIALIZED (
    SELECT pg_advisory_xact_lock(1984052701)
), current_category AS MATERIALIZED (
    SELECT category.id, category.sort
    FROM catalog_categories AS category
    CROSS JOIN lock_category_sort
    WHERE category.id = sqlc.arg('id')
), target_position AS MATERIALIZED (
    SELECT
        current_category.id,
        current_category.sort AS old_sort,
        CASE
            WHEN sqlc.narg('sort')::integer IS NULL THEN current_category.sort
            ELSE LEAST(GREATEST(sqlc.narg('sort')::integer, 1), count(*)::integer)
        END AS new_sort
    FROM current_category
    CROSS JOIN catalog_categories
    GROUP BY current_category.id, current_category.sort
), shifted AS (
    UPDATE catalog_categories AS category
    SET sort = CASE
            WHEN target_position.new_sort < target_position.old_sort THEN category.sort + 1
            ELSE category.sort - 1
        END,
        updated_at = now()
    FROM target_position
    WHERE category.id <> target_position.id
      AND (
          (target_position.new_sort < target_position.old_sort
              AND category.sort >= target_position.new_sort
              AND category.sort < target_position.old_sort)
          OR
          (target_position.new_sort > target_position.old_sort
              AND category.sort > target_position.old_sort
              AND category.sort <= target_position.new_sort)
      )
    RETURNING category.id
)
UPDATE catalog_categories AS category
SET name = COALESCE(sqlc.narg('name')::text, category.name),
    parent_id = CASE
        WHEN sqlc.arg('parent_id_set')::boolean THEN sqlc.narg('parent_id')::uuid
        ELSE category.parent_id
    END,
    sort = target_position.new_sort,
    updated_at = now()
FROM target_position
WHERE category.id = target_position.id
RETURNING category.id, category.name, category.parent_id, category.sort, category.created_at, category.updated_at;

-- name: DeleteCategory :one
WITH lock_category_sort AS MATERIALIZED (
    SELECT pg_advisory_xact_lock(1984052701)
), deleted AS (
    DELETE FROM catalog_categories AS category
    USING lock_category_sort
    WHERE category.id = $1
    RETURNING category.sort
), shifted AS (
    UPDATE catalog_categories AS category
    SET sort = category.sort - 1,
        updated_at = now()
    FROM deleted
    WHERE category.sort > deleted.sort
    RETURNING category.id
)
SELECT count(*)::bigint
FROM deleted;
