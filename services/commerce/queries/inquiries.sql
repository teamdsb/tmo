-- name: CreatePriceInquiry :one
INSERT INTO price_inquiries (
    status,
    created_by_user_id,
    owner_sales_user_id,
    assigned_sales_user_id,
    sku_id,
    order_id,
    message,
    response_note
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
)
RETURNING id, created_by_user_id, owner_sales_user_id, assigned_sales_user_id, sku_id, order_id, message, status, response_note, created_at, updated_at;

-- name: UpdatePriceInquiry :one
UPDATE price_inquiries
SET status = COALESCE(sqlc.narg('status')::text, status),
    assigned_sales_user_id = CASE
        WHEN sqlc.arg('assigned_sales_user_id_set')::boolean THEN sqlc.narg('assigned_sales_user_id')::uuid
        ELSE assigned_sales_user_id
    END,
    response_note = CASE
        WHEN sqlc.arg('response_note_set')::boolean THEN sqlc.narg('response_note')::text
        ELSE response_note
    END,
    updated_at = now()
WHERE id = $1
RETURNING id, created_by_user_id, owner_sales_user_id, assigned_sales_user_id, sku_id, order_id, message, status, response_note, created_at, updated_at;

-- name: GetPriceInquiry :one
SELECT id, created_by_user_id, owner_sales_user_id, assigned_sales_user_id, sku_id, order_id, message, status, response_note, created_at, updated_at
FROM price_inquiries
WHERE id = $1;

-- name: ListPriceInquiries :many
SELECT id, created_by_user_id, owner_sales_user_id, assigned_sales_user_id, sku_id, order_id, message, status, response_note, created_at, updated_at
FROM price_inquiries
WHERE (sqlc.narg('created_by_user_id')::uuid IS NULL OR created_by_user_id = sqlc.narg('created_by_user_id'))
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id') OR assigned_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPriceInquiries :one
SELECT count(*)
FROM price_inquiries
WHERE (sqlc.narg('created_by_user_id')::uuid IS NULL OR created_by_user_id = sqlc.narg('created_by_user_id'))
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id') OR assigned_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'));

-- name: CreateInquiryMessage :one
INSERT INTO inquiry_messages (
    inquiry_id,
    sender_type,
    sender_user_id,
    content
) VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING id, inquiry_id, sender_type, sender_user_id, content, created_at;

-- name: ListInquiryMessages :many
SELECT id, inquiry_id, sender_type, sender_user_id, content, created_at
FROM inquiry_messages
WHERE inquiry_id = $1
ORDER BY created_at ASC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountInquiryMessages :one
SELECT count(*)
FROM inquiry_messages
WHERE inquiry_id = $1;
