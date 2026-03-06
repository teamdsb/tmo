-- name: CreateProductImportJob :one
INSERT INTO product_import_jobs (
    job_id,
    excel_file_path,
    excel_file_name,
    images_zip_path,
    images_zip_name,
    image_base_url
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
RETURNING job_id, excel_file_path, excel_file_name, images_zip_path, images_zip_name, image_base_url, total_rows, success_rows, failed_rows, created_at, updated_at;

-- name: ClaimNextPendingProductImportJob :one
WITH picked AS (
    SELECT pj.job_id
    FROM product_import_jobs pj
    JOIN import_jobs ij ON ij.id = pj.job_id
    WHERE ij.type = 'PRODUCT_IMPORT'
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
    pj.job_id,
    pj.excel_file_path,
    pj.excel_file_name,
    pj.images_zip_path,
    pj.images_zip_name,
    pj.image_base_url,
    pj.total_rows,
    pj.success_rows,
    pj.failed_rows,
    pj.created_at AS product_import_created_at,
    pj.updated_at AS product_import_updated_at
FROM updated
JOIN product_import_jobs pj ON pj.job_id = updated.id;

-- name: ResetRunningProductImportJobs :execrows
UPDATE import_jobs
SET status = 'PENDING',
    progress = 0,
    updated_at = now()
WHERE type = 'PRODUCT_IMPORT'
  AND status = 'RUNNING';

-- name: UpdateProductImportJobCounts :one
UPDATE product_import_jobs
SET total_rows = $2,
    success_rows = $3,
    failed_rows = $4,
    updated_at = now()
WHERE job_id = $1
RETURNING job_id, excel_file_path, excel_file_name, images_zip_path, images_zip_name, image_base_url, total_rows, success_rows, failed_rows, created_at, updated_at;

-- name: GetProductImportJob :one
SELECT job_id, excel_file_path, excel_file_name, images_zip_path, images_zip_name, image_base_url, total_rows, success_rows, failed_rows, created_at, updated_at
FROM product_import_jobs
WHERE job_id = $1;

-- name: CreateProductImportRow :one
INSERT INTO product_import_rows (
    job_id,
    line_no,
    group_key,
    sku_code,
    product_name,
    row_data,
    status,
    error_message,
    product_id,
    sku_id
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10
)
RETURNING id, job_id, line_no, group_key, sku_code, product_name, row_data, status, error_message, product_id, sku_id, created_at, updated_at;

-- name: UpdateProductImportRowResult :one
UPDATE product_import_rows
SET status = $2,
    error_message = $3,
    product_id = $4,
    sku_id = $5,
    updated_at = now()
WHERE id = $1
RETURNING id, job_id, line_no, group_key, sku_code, product_name, row_data, status, error_message, product_id, sku_id, created_at, updated_at;

-- name: ListProductImportRowsByJob :many
SELECT id, job_id, line_no, group_key, sku_code, product_name, row_data, status, error_message, product_id, sku_id, created_at, updated_at
FROM product_import_rows
WHERE job_id = $1
ORDER BY line_no ASC;
