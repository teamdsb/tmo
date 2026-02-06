-- name: CreateAfterSalesTicket :one
INSERT INTO after_sales_tickets (
    status,
    order_id,
    created_by_user_id,
    owner_sales_user_id,
    assigned_staff_user_id,
    subject,
    description,
    attachments
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
RETURNING id, status, order_id, created_by_user_id, owner_sales_user_id, assigned_staff_user_id, subject, description, attachments, created_at, updated_at;

-- name: UpdateAfterSalesTicket :one
UPDATE after_sales_tickets
SET status = COALESCE(sqlc.narg('status')::text, status),
    assigned_staff_user_id = CASE
        WHEN sqlc.arg('assigned_staff_user_id_set')::boolean THEN sqlc.narg('assigned_staff_user_id')::uuid
        ELSE assigned_staff_user_id
    END,
    updated_at = now()
WHERE id = $1
RETURNING id, status, order_id, created_by_user_id, owner_sales_user_id, assigned_staff_user_id, subject, description, attachments, created_at, updated_at;

-- name: GetAfterSalesTicket :one
SELECT id, status, order_id, created_by_user_id, owner_sales_user_id, assigned_staff_user_id, subject, description, attachments, created_at, updated_at
FROM after_sales_tickets
WHERE id = $1;

-- name: ListAfterSalesTickets :many
SELECT id, status, order_id, created_by_user_id, owner_sales_user_id, assigned_staff_user_id, subject, description, attachments, created_at, updated_at
FROM after_sales_tickets
WHERE (sqlc.narg('created_by_user_id')::uuid IS NULL OR created_by_user_id = sqlc.narg('created_by_user_id'))
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (sqlc.narg('order_id')::uuid IS NULL OR order_id = sqlc.narg('order_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountAfterSalesTickets :one
SELECT count(*)
FROM after_sales_tickets
WHERE (sqlc.narg('created_by_user_id')::uuid IS NULL OR created_by_user_id = sqlc.narg('created_by_user_id'))
  AND (sqlc.narg('owner_sales_user_id')::uuid IS NULL OR owner_sales_user_id = sqlc.narg('owner_sales_user_id'))
  AND (sqlc.narg('order_id')::uuid IS NULL OR order_id = sqlc.narg('order_id'))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'));

-- name: CreateAfterSalesMessage :one
INSERT INTO after_sales_messages (
    ticket_id,
    sender_type,
    sender_user_id,
    content
) VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING id, ticket_id, sender_type, sender_user_id, content, created_at;

-- name: ListAfterSalesMessages :many
SELECT id, ticket_id, sender_type, sender_user_id, content, created_at
FROM after_sales_messages
WHERE ticket_id = $1
ORDER BY created_at ASC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountAfterSalesMessages :one
SELECT count(*)
FROM after_sales_messages
WHERE ticket_id = $1;
