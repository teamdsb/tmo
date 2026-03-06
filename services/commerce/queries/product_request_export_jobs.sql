-- name: CreateProductRequestExportJob :one
INSERT INTO product_request_export_jobs (
    job_id,
    created_after,
    created_before
) VALUES (
    $1,
    $2,
    $3
)
RETURNING job_id, created_after, created_before, exported_rows, created_at, updated_at;

-- name: ClaimNextPendingProductRequestExportJob :one
WITH picked AS (
    SELECT pej.job_id
    FROM product_request_export_jobs pej
    JOIN import_jobs ij ON ij.id = pej.job_id
    WHERE ij.type = 'PRODUCT_REQUEST_EXPORT'
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
    pej.created_after,
    pej.created_before,
    pej.exported_rows,
    pej.created_at AS export_created_at,
    pej.updated_at AS export_updated_at
FROM updated
JOIN product_request_export_jobs pej ON pej.job_id = updated.id;

-- name: ResetRunningProductRequestExportJobs :execrows
UPDATE import_jobs
SET status = 'PENDING',
    progress = 0,
    updated_at = now()
WHERE type = 'PRODUCT_REQUEST_EXPORT'
  AND status = 'RUNNING';

-- name: UpdateProductRequestExportJobRows :one
UPDATE product_request_export_jobs
SET exported_rows = $2,
    updated_at = now()
WHERE job_id = $1
RETURNING job_id, created_after, created_before, exported_rows, created_at, updated_at;

-- name: GetProductRequestExportJob :one
SELECT job_id, created_after, created_before, exported_rows, created_at, updated_at
FROM product_request_export_jobs
WHERE job_id = $1;
