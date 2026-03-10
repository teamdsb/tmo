-- name: CreateSupportConversation :one
INSERT INTO support_conversations (
    customer_user_id,
    owner_sales_user_id,
    assignee_user_id,
    assignee_role,
    status,
    last_message_type,
    last_message_preview,
    last_message_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    COALESCE($8, now())
)
RETURNING *;

-- name: GetActiveSupportConversationByCustomer :one
SELECT *
FROM support_conversations
WHERE customer_user_id = $1
  AND closed_at IS NULL
ORDER BY created_at DESC
LIMIT 1;

-- name: GetSupportConversation :one
SELECT *
FROM support_conversations
WHERE id = $1;

-- name: ListSupportConversations :many
SELECT *
FROM support_conversations
WHERE (sqlc.narg('assignee_user_id')::uuid IS NULL OR assignee_user_id = sqlc.narg('assignee_user_id'))
  AND (
    NOT sqlc.arg('unassigned_only')::boolean
    OR (assignee_user_id IS NULL AND status = 'OPEN_UNASSIGNED')
  )
  AND (
    NOT sqlc.arg('unread_only')::boolean
    OR staff_unread_count > 0
  )
  AND (
    sqlc.narg('customer_user_id')::uuid IS NULL
    OR customer_user_id = sqlc.narg('customer_user_id')
  )
  AND (
    sqlc.narg('owner_sales_user_id')::uuid IS NULL
    OR owner_sales_user_id = sqlc.narg('owner_sales_user_id')
  )
  AND (
    sqlc.narg('status')::text IS NULL
    OR status = sqlc.narg('status')
  )
ORDER BY last_message_at DESC, created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountSupportConversations :one
SELECT count(*)
FROM support_conversations
WHERE (sqlc.narg('assignee_user_id')::uuid IS NULL OR assignee_user_id = sqlc.narg('assignee_user_id'))
  AND (
    NOT sqlc.arg('unassigned_only')::boolean
    OR (assignee_user_id IS NULL AND status = 'OPEN_UNASSIGNED')
  )
  AND (
    NOT sqlc.arg('unread_only')::boolean
    OR staff_unread_count > 0
  )
  AND (
    sqlc.narg('customer_user_id')::uuid IS NULL
    OR customer_user_id = sqlc.narg('customer_user_id')
  )
  AND (
    sqlc.narg('owner_sales_user_id')::uuid IS NULL
    OR owner_sales_user_id = sqlc.narg('owner_sales_user_id')
  )
  AND (
    sqlc.narg('status')::text IS NULL
    OR status = sqlc.narg('status')
  );

-- name: ClaimSupportConversation :one
UPDATE support_conversations
SET assignee_user_id = $2,
    assignee_role = $3,
    status = 'OPEN_ASSIGNED',
    updated_at = now()
WHERE id = $1
  AND closed_at IS NULL
  AND (assignee_user_id IS NULL OR assignee_user_id = $2)
RETURNING *;

-- name: ReleaseSupportConversation :one
UPDATE support_conversations
SET assignee_user_id = NULL,
    assignee_role = NULL,
    status = 'OPEN_UNASSIGNED',
    updated_at = now()
WHERE id = $1
  AND closed_at IS NULL
RETURNING *;

-- name: TransferSupportConversation :one
UPDATE support_conversations
SET assignee_user_id = $2,
    assignee_role = $3,
    status = 'OPEN_ASSIGNED',
    updated_at = now()
WHERE id = $1
  AND closed_at IS NULL
RETURNING *;

-- name: UpdateSupportConversationAfterMessage :one
UPDATE support_conversations
SET last_message_type = $2,
    last_message_preview = $3,
    last_message_at = $4,
    customer_unread_count = $5,
    staff_unread_count = $6,
    status = $7,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: MarkSupportConversationReadForCustomer :one
UPDATE support_conversations
SET customer_unread_count = 0,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: MarkSupportConversationReadForStaff :one
UPDATE support_conversations
SET staff_unread_count = 0,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: CreateSupportMessageAsset :one
INSERT INTO support_message_assets (
    conversation_id,
    uploaded_by_user_id,
    content_type,
    file_name,
    file_size,
    url
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
RETURNING *;

-- name: GetSupportMessageAsset :one
SELECT *
FROM support_message_assets
WHERE id = $1;

-- name: CreateSupportMessage :one
INSERT INTO support_messages (
    conversation_id,
    sender_type,
    sender_user_id,
    sender_role,
    message_type,
    text_content,
    asset_id,
    card_payload
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
RETURNING *;

-- name: ListSupportMessages :many
SELECT *
FROM support_messages
WHERE conversation_id = $1
ORDER BY created_at ASC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountSupportMessages :one
SELECT count(*)
FROM support_messages
WHERE conversation_id = $1;

-- name: CreateSupportConversationTransfer :one
INSERT INTO support_conversation_transfers (
    conversation_id,
    from_user_id,
    from_role,
    to_user_id,
    to_role,
    note,
    created_by_user_id
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
