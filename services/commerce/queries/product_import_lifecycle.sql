-- name: GetProductImportLifecycle :one
SELECT * FROM product_import_jobs WHERE job_id = $1;

-- name: LockProductImportLifecycle :one
SELECT * FROM product_import_jobs WHERE job_id = $1 FOR UPDATE;

-- name: ClaimProductImportLifecycle :one
WITH candidate AS (
    SELECT pj.job_id FROM product_import_jobs pj JOIN import_jobs ij ON ij.id = pj.job_id
    WHERE ij.type = 'PRODUCT_IMPORT'
      AND ((ij.status = 'PENDING' AND pj.phase IN ('VALIDATE_PENDING', 'COMMIT_PENDING'))
        OR (ij.status = 'RUNNING' AND pj.phase IN ('VALIDATING', 'COMMITTING')
            AND (pj.lease_expires_at IS NULL OR pj.lease_expires_at < now())))
    ORDER BY ij.created_at, ij.id FOR UPDATE OF pj SKIP LOCKED LIMIT 1
), claimed AS (
    UPDATE product_import_jobs pj
    SET lease_token = gen_random_uuid(), lease_expires_at = now() + interval '60 seconds',
        phase = CASE WHEN pj.phase IN ('COMMIT_PENDING', 'COMMITTING') THEN 'COMMITTING' ELSE 'VALIDATING' END,
        updated_at = now()
    FROM candidate WHERE pj.job_id = candidate.job_id RETURNING pj.*
), base AS (
    UPDATE import_jobs ij SET status = 'RUNNING', updated_at = now()
    FROM claimed WHERE ij.id = claimed.job_id RETURNING ij.id
)
SELECT claimed.* FROM claimed JOIN base ON base.id = claimed.job_id;

-- name: HeartbeatProductImportLifecycle :execrows
UPDATE product_import_jobs SET lease_expires_at = now() + interval '60 seconds', updated_at = now()
WHERE job_id = $1 AND lease_token = $2 AND lease_expires_at > now()
  AND phase IN ('VALIDATING', 'COMMITTING');

-- name: GetProductImportSourceRef :one
SELECT * FROM product_import_source_refs
WHERE source_namespace = $1 AND source_product_key = $2 AND source_sku_key = $3;

-- name: ListProductImportSourceGroup :many
SELECT * FROM product_import_source_refs WHERE source_namespace = $1 AND source_product_key = $2;

-- name: GetProductImportSourceSKU :one
SELECT * FROM product_import_source_refs WHERE source_namespace = $1 AND source_sku_key = $2;

-- name: ListProductImportSourceFamily :many
SELECT * FROM product_import_source_refs WHERE source_namespace = $1 AND original_source_product_key = $2;

-- name: UpsertProductImportSourceRef :exec
INSERT INTO product_import_source_refs (source_namespace,source_product_key,source_sku_key,source_fingerprint,product_id,sku_id,first_job_id,last_job_id,source_product_fingerprint,original_source_product_key)
VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)
ON CONFLICT (source_namespace,source_product_key,source_sku_key) DO UPDATE
SET source_fingerprint = EXCLUDED.source_fingerprint, source_product_fingerprint = EXCLUDED.source_product_fingerprint, last_job_id = EXCLUDED.last_job_id, updated_at = now();

-- name: CreateProductImportReview :exec
INSERT INTO product_import_reviews (job_id,product_id,sku_id,source_namespace,source_product_key,source_sku_key,source_fingerprint,source_sheet,source_row,code,message,raw_values)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
ON CONFLICT (source_namespace,source_product_key,source_sku_key,source_fingerprint,code) DO NOTHING;

-- name: CountPendingProductImportReviews :one
SELECT count(*) FROM product_import_reviews WHERE product_id = $1 AND status = 'PENDING';
