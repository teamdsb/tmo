-- name: CreateProductExportJob :one
INSERT INTO product_export_jobs (
    job_id,
    query,
    category_id,
    product_status,
    needs_review
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
)
RETURNING job_id, query, category_id, product_status, needs_review, exported_rows, created_at, updated_at;

-- name: ClaimNextPendingProductExportJob :one
WITH picked AS (
    SELECT pej.job_id
    FROM product_export_jobs pej
    JOIN import_jobs ij ON ij.id = pej.job_id
    WHERE ij.type = 'PRODUCT_EXPORT'
      AND ij.status = 'PENDING'
    ORDER BY ij.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
), updated AS (
    UPDATE import_jobs ij
    SET status = 'RUNNING',
        progress = 1,
        updated_at = now()
    FROM picked
    WHERE ij.id = picked.job_id
    RETURNING ij.id, ij.type, ij.status, ij.progress, ij.result_file_url, ij.error_report_url, ij.created_by_user_id, ij.created_at, ij.updated_at
)
SELECT
    updated.id,
    updated.type,
    updated.status,
    updated.progress,
    updated.result_file_url,
    updated.error_report_url,
    updated.created_by_user_id,
    updated.created_at,
    updated.updated_at,
    pej.job_id,
    pej.query,
    pej.category_id,
    pej.product_status,
    pej.needs_review,
    pej.exported_rows,
    pej.created_at AS export_created_at,
    pej.updated_at AS export_updated_at
FROM updated
JOIN product_export_jobs pej ON pej.job_id = updated.id;

-- name: ResetRunningProductExportJobs :execrows
UPDATE import_jobs
SET status = 'PENDING',
    progress = 0,
    updated_at = now()
WHERE type = 'PRODUCT_EXPORT'
  AND status = 'RUNNING';

-- name: UpdateProductExportJobRows :one
UPDATE product_export_jobs
SET exported_rows = $2,
    updated_at = now()
WHERE job_id = $1
RETURNING job_id, query, category_id, product_status, needs_review, exported_rows, created_at, updated_at;

-- name: GetProductExportJob :one
SELECT job_id, query, category_id, product_status, needs_review, exported_rows, created_at, updated_at
FROM product_export_jobs
WHERE job_id = $1;

-- name: ListProductExportProducts :many
SELECT p.id, p.name, p.description, p.category_id, p.cover_image_url, p.images, p.tags, p.filter_dimensions, p.created_at, p.updated_at, p.status
FROM catalog_products p
WHERE (
    sqlc.narg('q')::text IS NULL
    OR position(lower(btrim(sqlc.narg('q')::text)) in lower(p.name)) > 0
    OR position(lower(btrim(sqlc.narg('q')::text)) in lower(p.id::text)) > 0
    OR position(lower(btrim(sqlc.narg('q')::text)) in lower(coalesce((SELECT c.name FROM catalog_categories c WHERE c.id = p.category_id), '无'))) > 0
    OR EXISTS (
        SELECT 1 FROM catalog_skus s
        WHERE s.product_id = p.id
          AND position(lower(btrim(sqlc.narg('q')::text)) in lower(s.name || ' ' || coalesce(s.sku_code, ''))) > 0
    )
)
  AND (sqlc.narg('category_id')::uuid IS NULL OR p.category_id = sqlc.narg('category_id'))
  AND (sqlc.narg('status')::text IS NULL OR p.status = sqlc.narg('status'))
  AND (NOT sqlc.arg('needs_review')::boolean OR EXISTS (
      SELECT 1 FROM product_import_reviews r WHERE r.product_id = p.id AND r.status = 'PENDING'
  ))
ORDER BY CASE p.status WHEN 'ACTIVE' THEN 0 WHEN 'DRAFT' THEN 1 WHEN 'INACTIVE' THEN 2 ELSE 3 END,
         p.created_at DESC, p.id ASC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');
