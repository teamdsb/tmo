-- +goose Up
-- +goose StatementBegin
ALTER TABLE product_import_jobs
    ADD COLUMN IF NOT EXISTS source_format text NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS source_namespace text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'VALIDATE_PENDING',
    ADD COLUMN IF NOT EXISTS preview_revision integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS lease_token uuid,
    ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS confirmed_revision integer,
    ADD COLUMN IF NOT EXISTS confirmed_by_user_id uuid,
    ADD COLUMN IF NOT EXISTS confirm_idempotency_key text;

-- Legacy workers may already have committed groups without source identities.
-- Preserve their audit instead of replaying unfinished jobs and duplicating products.
DO $$
DECLARE
    legacy_job record;
    row_total integer;
    row_success integer;
    row_failed integer;
    row_skipped integer;
BEGIN
    FOR legacy_job IN
        SELECT pj.job_id, pj.total_rows, pj.success_rows, pj.failed_rows, ij.status
        FROM product_import_jobs pj JOIN import_jobs ij ON ij.id = pj.job_id
        WHERE ij.type = 'PRODUCT_IMPORT'
          AND (ij.status IN ('SUCCEEDED', 'FAILED', 'RUNNING') OR (ij.status = 'PENDING' AND EXISTS (
              SELECT 1 FROM product_import_rows r WHERE r.job_id = pj.job_id AND r.status = 'SUCCEEDED'
          )))
          AND pj.preview_revision = 0 AND pj.phase = 'VALIDATE_PENDING' AND pj.lease_token IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM product_import_rows r WHERE r.job_id = pj.job_id AND r.row_data ? 'parsed'
          )
        FOR UPDATE OF pj, ij
    LOOP
        IF legacy_job.status IN ('RUNNING', 'PENDING') THEN
            UPDATE product_import_rows
            SET status = 'FAILED',
                error_message = '旧版导入因升级中断；已成功行保留，请核对商品与本行后再通过带 ID 的文件导入，避免重复创建。',
                updated_at = now()
            WHERE job_id = legacy_job.job_id AND status NOT IN ('SUCCEEDED', 'FAILED', 'SKIPPED');
            UPDATE import_jobs SET status = 'FAILED', progress = 100, updated_at = now()
            WHERE id = legacy_job.job_id;
        END IF;
        SELECT count(*), count(*) FILTER (WHERE status = 'SUCCEEDED'),
               count(*) FILTER (WHERE status = 'FAILED'), count(*) FILTER (WHERE status = 'SKIPPED')
        INTO row_total, row_success, row_failed, row_skipped
        FROM product_import_rows WHERE job_id = legacy_job.job_id;
        IF row_total = 0 THEN
            row_success := legacy_job.success_rows;
            row_failed := legacy_job.failed_rows;
        END IF;
        row_total := greatest(row_total, legacy_job.total_rows);
        UPDATE product_import_jobs
        SET phase = 'COMPLETED', total_rows = row_total, success_rows = row_success, failed_rows = row_failed,
            summary = jsonb_build_object('totalRows', row_total, 'successRows', row_success,
                'failedRows', row_failed, 'skippedRows', row_skipped, 'splitProducts', 0,
                'reviewCount', 0, 'productCreates', 0, 'productUpdates', 0, 'skuCreates', 0, 'skuUpdates', 0),
            updated_at = now()
        WHERE job_id = legacy_job.job_id;
    END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS product_import_source_refs (
    source_namespace text NOT NULL,
    source_product_key text NOT NULL,
    source_sku_key text NOT NULL,
    source_fingerprint text NOT NULL,
    product_id uuid NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
    sku_id uuid REFERENCES catalog_skus(id) ON DELETE CASCADE,
    first_job_id uuid NOT NULL REFERENCES import_jobs(id),
    last_job_id uuid NOT NULL REFERENCES import_jobs(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source_namespace, source_product_key, source_sku_key),
    UNIQUE (source_namespace, source_sku_key)
);
CREATE INDEX IF NOT EXISTS product_import_source_refs_product_idx ON product_import_source_refs(product_id);
ALTER TABLE product_import_source_refs ADD COLUMN IF NOT EXISTS source_product_fingerprint text NOT NULL DEFAULT '';
ALTER TABLE product_import_source_refs ADD COLUMN IF NOT EXISTS original_source_product_key text NOT NULL DEFAULT '';
ALTER TABLE product_import_source_refs DROP CONSTRAINT IF EXISTS product_import_source_refs_product_id_fkey;
ALTER TABLE product_import_source_refs ADD CONSTRAINT product_import_source_refs_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE;
ALTER TABLE product_import_source_refs DROP CONSTRAINT IF EXISTS product_import_source_refs_sku_id_fkey;
ALTER TABLE product_import_source_refs ADD CONSTRAINT product_import_source_refs_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES catalog_skus(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS product_import_source_refs_sku_idx ON product_import_source_refs(source_namespace, source_sku_key);

CREATE TABLE IF NOT EXISTS product_import_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES import_jobs(id),
    product_id uuid NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
    sku_id uuid REFERENCES catalog_skus(id) ON DELETE SET NULL,
    source_namespace text NOT NULL,
    source_product_key text NOT NULL,
    source_sku_key text NOT NULL,
    source_fingerprint text NOT NULL,
    source_sheet text NOT NULL DEFAULT '',
    source_row integer NOT NULL,
    code text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED')),
    raw_values jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by_user_id uuid,
    UNIQUE (source_namespace, source_product_key, source_sku_key, source_fingerprint, code)
);
CREATE INDEX IF NOT EXISTS product_import_reviews_status_idx ON product_import_reviews(status, created_at DESC, id);
CREATE INDEX IF NOT EXISTS product_import_reviews_product_idx ON product_import_reviews(product_id, status);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS product_import_reviews;
DROP TABLE IF EXISTS product_import_source_refs;
ALTER TABLE product_import_jobs
    DROP COLUMN IF EXISTS source_format,
    DROP COLUMN IF EXISTS source_namespace,
    DROP COLUMN IF EXISTS phase,
    DROP COLUMN IF EXISTS preview_revision,
    DROP COLUMN IF EXISTS summary,
    DROP COLUMN IF EXISTS lease_token,
    DROP COLUMN IF EXISTS lease_expires_at,
    DROP COLUMN IF EXISTS confirmed_revision,
    DROP COLUMN IF EXISTS confirmed_by_user_id,
    DROP COLUMN IF EXISTS confirm_idempotency_key;
-- +goose StatementEnd
