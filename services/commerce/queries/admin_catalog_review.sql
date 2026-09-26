-- name: CountAdminCatalogProducts :one
SELECT count(*)
FROM catalog_products p
WHERE (sqlc.narg('q')::text IS NULL OR
    position(lower(btrim(sqlc.narg('q')::text)) in lower(p.name || ' ' || p.id::text)) > 0 OR
    EXISTS (SELECT 1 FROM catalog_skus s WHERE s.product_id = p.id AND
      position(lower(btrim(sqlc.narg('q')::text)) in lower(s.name || ' ' || coalesce(s.sku_code, ''))) > 0) OR
    EXISTS (SELECT 1 FROM catalog_categories c WHERE c.id = p.category_id AND
      position(lower(btrim(sqlc.narg('q')::text)) in lower(c.name)) > 0))
  AND (sqlc.narg('category_id')::uuid IS NULL OR p.category_id = sqlc.narg('category_id'))
  AND (sqlc.narg('status')::text IS NULL OR p.status = sqlc.narg('status'))
  AND (NOT sqlc.arg('needs_review')::boolean OR EXISTS (
      SELECT 1 FROM product_import_reviews r WHERE r.product_id = p.id AND r.status = 'PENDING'
  ));

-- name: ListProductImportSourceEvidence :many
SELECT refs.product_id, refs.sku_id, refs.source_namespace, refs.source_product_key, refs.source_sku_key,
       coalesce(rows.row_data, '{}'::jsonb)::jsonb AS source_data
FROM product_import_source_refs refs
LEFT JOIN LATERAL (
    SELECT r.row_data FROM product_import_rows r
    WHERE r.job_id = refs.last_job_id AND r.product_id = refs.product_id
      AND r.sku_id IS NOT DISTINCT FROM refs.sku_id
    ORDER BY r.line_no LIMIT 1
) rows ON true
WHERE refs.product_id = ANY(sqlc.arg('product_ids')::uuid[])
ORDER BY refs.product_id, refs.source_namespace, refs.source_product_key, refs.source_sku_key;

-- name: ProductActiveWithPendingReview :one
SELECT EXISTS (
    SELECT 1 FROM catalog_products p JOIN product_import_reviews r ON r.product_id = p.id
    WHERE p.id = $1 AND p.status = 'ACTIVE' AND r.status = 'PENDING'
);
