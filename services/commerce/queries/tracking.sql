-- name: UpsertTrackingShipment :one
INSERT INTO order_tracking_shipments (
    order_id,
    waybill_no,
    carrier,
    shipped_at
) VALUES (
    $1,
    $2,
    $3,
    $4
)
ON CONFLICT (order_id, waybill_no)
DO UPDATE SET carrier = EXCLUDED.carrier,
              shipped_at = EXCLUDED.shipped_at,
              updated_at = now()
RETURNING id, order_id, waybill_no, carrier, shipped_at, created_at, updated_at;

-- name: ListTrackingShipments :many
SELECT id, order_id, waybill_no, carrier, shipped_at, created_at, updated_at
FROM order_tracking_shipments
WHERE order_id = $1
ORDER BY created_at ASC;
