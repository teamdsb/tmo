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
RETURNING id, type, status, progress, result_file_url, error_report_url, created_by_user_id, created_at;

-- name: GetImportJob :one
SELECT id, type, status, progress, result_file_url, error_report_url, created_by_user_id, created_at
FROM import_jobs
WHERE id = $1;
