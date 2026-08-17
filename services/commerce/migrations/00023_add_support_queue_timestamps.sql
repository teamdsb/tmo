-- +goose Up
ALTER TABLE support_conversations
ADD COLUMN IF NOT EXISTS queued_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

UPDATE support_conversations
SET queued_at = created_at,
    assigned_at = CASE
        WHEN status = 'OPEN_ASSIGNED' THEN updated_at
        ELSE NULL
    END;

-- +goose Down
ALTER TABLE support_conversations
DROP COLUMN assigned_at,
DROP COLUMN queued_at;
