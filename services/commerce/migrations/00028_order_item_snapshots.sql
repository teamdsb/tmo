-- +goose Up
-- +goose StatementBegin
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku_snapshot jsonb;

-- Shared by order creation, seed data and the one-time legacy backfill.
-- Existing order snapshots are never refreshed when the catalog changes.
CREATE OR REPLACE FUNCTION order_sku_snapshot(target_sku_id uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$
    SELECT jsonb_strip_nulls(jsonb_build_object(
        'id', s.id,
        'spuId', s.product_id,
        'name', s.name,
        'isActive', s.is_active,
        'skuCode', s.sku_code,
        'spec', s.spec,
        'unit', s.unit,
        'attributes', NULLIF(s.attributes, '{}'::jsonb),
        'priceTiers', (
            SELECT jsonb_agg(jsonb_build_object(
                'minQty', t.min_qty,
                'maxQty', t.max_qty,
                'unitPriceFen', t.unit_price_fen
            ) ORDER BY t.min_qty, t.id)
            FROM catalog_price_tiers t WHERE t.sku_id = s.id
        )
    ))
    FROM catalog_skus s WHERE s.id = target_sku_id;
$$;

-- Older application instances and direct seed/import writers may omit the
-- new column during a rolling deployment. Fill it at INSERT only, never on
-- catalog edits or ordinary order-item updates.
CREATE OR REPLACE FUNCTION fill_order_item_sku_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.sku_snapshot IS NULL THEN
        NEW.sku_snapshot := order_sku_snapshot(NEW.sku_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER order_items_fill_sku_snapshot
BEFORE INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION fill_order_item_sku_snapshot();

-- Historical catalog changes cannot be reconstructed. Capture the catalog
-- available at migration time only for rows that do not already have a snapshot.
UPDATE order_items
SET sku_snapshot = order_sku_snapshot(sku_id)
WHERE sku_snapshot IS NULL;

ALTER TABLE order_items ALTER COLUMN sku_snapshot SET NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS order_items_fill_sku_snapshot ON order_items;
ALTER TABLE order_items DROP COLUMN IF EXISTS sku_snapshot;
DROP FUNCTION IF EXISTS fill_order_item_sku_snapshot();
DROP FUNCTION IF EXISTS order_sku_snapshot(uuid);
-- +goose StatementEnd
