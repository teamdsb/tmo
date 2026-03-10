-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS support_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_user_id uuid NOT NULL,
    owner_sales_user_id uuid,
    assignee_user_id uuid,
    assignee_role text,
    status text NOT NULL DEFAULT 'OPEN_UNASSIGNED',
    last_message_type text,
    last_message_preview text,
    last_message_at timestamptz NOT NULL DEFAULT now(),
    customer_unread_count integer NOT NULL DEFAULT 0,
    staff_unread_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS support_conversations_customer_active_idx
ON support_conversations(customer_user_id)
WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS support_conversations_assignee_idx ON support_conversations(assignee_user_id);
CREATE INDEX IF NOT EXISTS support_conversations_owner_sales_idx ON support_conversations(owner_sales_user_id);
CREATE INDEX IF NOT EXISTS support_conversations_status_idx ON support_conversations(status);
CREATE INDEX IF NOT EXISTS support_conversations_last_message_at_idx ON support_conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS support_message_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
    uploaded_by_user_id uuid NOT NULL,
    content_type text NOT NULL,
    file_name text NOT NULL,
    file_size bigint NOT NULL,
    url text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_message_assets_conversation_idx ON support_message_assets(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
    sender_type text NOT NULL,
    sender_user_id uuid,
    sender_role text,
    message_type text NOT NULL,
    text_content text,
    asset_id uuid REFERENCES support_message_assets(id) ON DELETE SET NULL,
    card_payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_conversation_idx ON support_messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS support_conversation_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
    from_user_id uuid,
    from_role text,
    to_user_id uuid NOT NULL,
    to_role text NOT NULL,
    note text,
    created_by_user_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_conversation_transfers_conversation_idx
ON support_conversation_transfers(conversation_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS support_conversation_transfers;
DROP TABLE IF EXISTS support_messages;
DROP TABLE IF EXISTS support_message_assets;
DROP TABLE IF EXISTS support_conversations;
-- +goose StatementEnd
