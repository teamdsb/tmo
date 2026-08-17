-- +goose Up
ALTER TABLE support_conversations
    ADD COLUMN IF NOT EXISTS queued_at timestamptz,
    ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

UPDATE support_conversations
SET queued_at = created_at
WHERE queued_at IS NULL;

UPDATE support_conversations
SET assigned_at = updated_at
WHERE status = 'OPEN_ASSIGNED'
  AND assigned_at IS NULL;

ALTER TABLE support_conversations
    ALTER COLUMN queued_at SET DEFAULT now(),
    ALTER COLUMN queued_at SET NOT NULL;

-- +goose Down
ALTER TABLE support_conversations
DROP COLUMN IF EXISTS assigned_at,
DROP COLUMN IF EXISTS queued_at;
