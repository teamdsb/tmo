-- name: CreateImportJob :one
INSERT INTO import_jobs (
    type,
    status,
    progress,
    result_file_url,
    error_report_url,
    created_by_user_id
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
RETURNING id, type, status, progress, result_file_url, error_report_url, created_by_user_id, created_at, updated_at;

-- name: GetImportJob :one
SELECT id, type, status, progress, result_file_url, error_report_url, created_by_user_id, created_at, updated_at
FROM import_jobs
WHERE id = $1;

-- name: UpdateImportJobStatus :one
UPDATE import_jobs
SET status = $2,
    progress = $3,
    updated_at = now()
WHERE id = $1
RETURNING id, type, status, progress, result_file_url, error_report_url, created_by_user_id, created_at, updated_at;

-- name: FinalizeImportJob :one
UPDATE import_jobs
SET status = $2,
    progress = $3,
    result_file_url = $4,
    error_report_url = $5,
    updated_at = now()
WHERE id = $1
RETURNING id, type, status, progress, result_file_url, error_report_url, created_by_user_id, created_at, updated_at;
