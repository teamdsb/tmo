-- name: CreateOrder :one
INSERT INTO orders (
    status,
    customer_id,
    owner_sales_user_id,
    address,
    remark,
    idempotency_key
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
RETURNING id, status, customer_id, owner_sales_user_id, address, remark, idempotency_key, created_at, updated_at;

-- name: CreateOrderItem :one
INSERT INTO order_items (
    order_id,
    sku_id,
    qty,
    unit_price_fen
) VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING id, order_id, sku_id, qty, unit_price_fen, created_at, updated_at;

-- name: ListOrders :many
SELECT id, status, customer_id, owner_sales_user_id, address, remark, idempotency_key, created_at, updated_at
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

-- name: GetOrder :one
SELECT id, status, customer_id, owner_sales_user_id, address, remark, idempotency_key, created_at, updated_at
FROM orders
WHERE id = $1;

-- name: ListOrderItems :many
SELECT id, order_id, sku_id, qty, unit_price_fen, created_at, updated_at
FROM order_items
WHERE order_id = $1
ORDER BY created_at ASC;

-- name: GetOrderByIdempotencyKey :one
SELECT id, status, customer_id, owner_sales_user_id, address, remark, idempotency_key, created_at, updated_at
FROM orders
WHERE customer_id = $1 AND idempotency_key = $2;
