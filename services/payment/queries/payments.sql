-- name: CreatePayment :one
INSERT INTO payments (
    order_id,
    payer_user_id,
    channel,
    status,
    amount_fen,
    currency,
    idempotency_key,
    provider_trade_no,
    provider_prepay_id,
    provider_payload,
    failure_code,
    failure_message,
    paid_at,
    closed_at
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
    $11,
    $12,
    $13,
    $14
)
RETURNING *;

-- name: GetPayment :one
SELECT *
FROM payments
WHERE id = $1;

-- name: GetPaymentByIdempotencyKey :one
SELECT *
FROM payments
WHERE order_id = $1
  AND channel = $2
  AND idempotency_key = $3;

-- name: UpdatePaymentState :one
UPDATE payments
SET status = $2,
    provider_trade_no = COALESCE($3, provider_trade_no),
    provider_prepay_id = COALESCE($4, provider_prepay_id),
    provider_payload = COALESCE($5, provider_payload),
    failure_code = $6,
    failure_message = $7,
    paid_at = $8,
    closed_at = $9,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListPayments :many
SELECT *
FROM payments
WHERE (
    sqlc.narg('q')::text IS NULL
    OR id::text ILIKE '%' || sqlc.narg('q') || '%'
    OR order_id::text ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(provider_trade_no, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(payer_user_id::text, '') ILIKE '%' || sqlc.narg('q') || '%'
)
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('channel')::text IS NULL OR channel = sqlc.narg('channel'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPayments :one
SELECT count(*)
FROM payments
WHERE (
    sqlc.narg('q')::text IS NULL
    OR id::text ILIKE '%' || sqlc.narg('q') || '%'
    OR order_id::text ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(provider_trade_no, '') ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(payer_user_id::text, '') ILIKE '%' || sqlc.narg('q') || '%'
)
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('channel')::text IS NULL OR channel = sqlc.narg('channel'));

-- name: CreatePaymentWebhook :one
INSERT INTO payment_webhooks (
    payment_id,
    provider,
    event_type,
    delivery_status,
    raw_body,
    processed_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
RETURNING *;

-- name: GetPaymentWebhook :one
SELECT *
FROM payment_webhooks
WHERE id = $1;

-- name: ListPaymentWebhooks :many
SELECT *
FROM payment_webhooks
WHERE (
    sqlc.narg('q')::text IS NULL
    OR id::text ILIKE '%' || sqlc.narg('q') || '%'
    OR event_type ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(payment_id::text, '') ILIKE '%' || sqlc.narg('q') || '%'
)
  AND (sqlc.narg('provider')::text IS NULL OR provider = sqlc.narg('provider'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPaymentWebhooks :one
SELECT count(*)
FROM payment_webhooks
WHERE (
    sqlc.narg('q')::text IS NULL
    OR id::text ILIKE '%' || sqlc.narg('q') || '%'
    OR event_type ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(payment_id::text, '') ILIKE '%' || sqlc.narg('q') || '%'
)
  AND (sqlc.narg('provider')::text IS NULL OR provider = sqlc.narg('provider'));

-- name: ReplayPaymentWebhook :one
UPDATE payment_webhooks
SET replay_count = replay_count + 1,
    delivery_status = $2,
    processed_at = $3,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: CreatePaymentAuditLog :one
INSERT INTO payment_audit_logs (
    payment_id,
    action,
    actor,
    detail
) VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING *;

-- name: ListPaymentAuditLogs :many
SELECT *
FROM payment_audit_logs
WHERE (
    sqlc.narg('q')::text IS NULL
    OR detail ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(payment_id::text, '') ILIKE '%' || sqlc.narg('q') || '%'
)
  AND (sqlc.narg('action')::text IS NULL OR action = sqlc.narg('action'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPaymentAuditLogs :one
SELECT count(*)
FROM payment_audit_logs
WHERE (
    sqlc.narg('q')::text IS NULL
    OR detail ILIKE '%' || sqlc.narg('q') || '%'
    OR COALESCE(payment_id::text, '') ILIKE '%' || sqlc.narg('q') || '%'
)
  AND (sqlc.narg('action')::text IS NULL OR action = sqlc.narg('action'));
