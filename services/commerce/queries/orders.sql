-- name: CreateOrder :one
INSERT INTO orders (
    status,
    customer_id,
    owner_sales_user_id,
    address,
    remark,
    idempotency_key,
    payment_status
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7
)
RETURNING *;

-- name: CreateOrderItem :one
INSERT INTO order_items (
    order_id,
    sku_id,
    source_cart_item_id,
    qty,
    unit_price_fen
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
)
RETURNING *;

-- name: ListOrders :many
SELECT *
FROM orders
WHERE (sqlc.narg('customer_id')::uuid IS NULL OR customer_id = sqlc.narg('customer_id'))
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountOrders :one
SELECT count(*)
FROM orders
WHERE (sqlc.narg('customer_id')::uuid IS NULL OR customer_id = sqlc.narg('customer_id'))
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'));

-- name: ListOrderStatusStats :many
SELECT status, count(*)::bigint AS order_count
FROM orders
WHERE (sqlc.narg('customer_id')::uuid IS NULL OR customer_id = sqlc.narg('customer_id'))
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
GROUP BY status
ORDER BY status;

-- name: GetOrder :one
SELECT *
FROM orders
WHERE id = $1;

-- name: GetOrderForUpdate :one
SELECT *
FROM orders
WHERE id = $1
FOR UPDATE;

-- name: ListOrderItems :many
SELECT *
FROM order_items
WHERE order_id = $1
ORDER BY created_at ASC;

-- name: GetOrderByIdempotencyKey :one
SELECT *
FROM orders
WHERE customer_id = $1 AND idempotency_key = $2;

-- name: UpdateOrderPaymentSummary :one
UPDATE orders
SET status = $2,
    payment_status = $3,
    latest_payment_id = $4,
    payment_channel = $5,
    paid_at = $6,
    updated_at = now()
WHERE id = $1
RETURNING *;
