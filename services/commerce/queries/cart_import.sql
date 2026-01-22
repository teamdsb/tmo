-- name: CreateCartImportJob :one
INSERT INTO cart_import_jobs (
    owner_user_id,
    status,
    progress,
    auto_added_count,
    pending_count
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
)
RETURNING id, owner_user_id, status, progress, auto_added_count, pending_count, created_at, updated_at;

-- name: UpdateCartImportJobCounts :exec
UPDATE cart_import_jobs
SET auto_added_count = $2,
    pending_count = $3,
    status = $4,
    progress = $5,
    updated_at = now()
WHERE id = $1;

-- name: GetCartImportJob :one
SELECT id, owner_user_id, status, progress, auto_added_count, pending_count, created_at, updated_at
FROM cart_import_jobs
WHERE id = $1;

-- name: CreateCartImportRow :one
INSERT INTO cart_import_rows (
    job_id,
    row_no,
    raw_name,
    raw_spec,
    raw_qty,
    match_type,
    sku_id,
    qty,
    candidate_sku_ids,
    selected_sku_id,
    selected_qty
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
    $10,
    $11
)
RETURNING id, job_id, row_no, raw_name, raw_spec, raw_qty, match_type, sku_id, qty, candidate_sku_ids, selected_sku_id, selected_qty, created_at, updated_at;

-- name: ListCartImportRows :many
SELECT id, job_id, row_no, raw_name, raw_spec, raw_qty, match_type, sku_id, qty, candidate_sku_ids, selected_sku_id, selected_qty, created_at, updated_at
FROM cart_import_rows
WHERE job_id = $1
ORDER BY row_no ASC;

-- name: UpdateCartImportRowSelection :exec
UPDATE cart_import_rows
SET selected_sku_id = $2,
    selected_qty = $3,
    updated_at = now()
WHERE job_id = $1 AND row_no = $4;
