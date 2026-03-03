-- +goose Up
-- +goose StatementBegin
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_term_type text,
  ADD COLUMN IF NOT EXISTS payment_term_days integer,
  ADD COLUMN IF NOT EXISTS payment_term_custom_label text;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_payment_term_type_check,
  ADD CONSTRAINT users_payment_term_type_check CHECK (
    payment_term_type IS NULL OR payment_term_type IN ('CASH', 'MONTHLY', 'CUSTOM')
  );

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_payment_term_config_check,
  ADD CONSTRAINT users_payment_term_config_check CHECK (
    (
      payment_term_type IS NULL
      AND payment_term_days IS NULL
      AND payment_term_custom_label IS NULL
    )
    OR (
      payment_term_type = 'CASH'
      AND payment_term_days IS NULL
      AND payment_term_custom_label IS NULL
    )
    OR (
      payment_term_type = 'MONTHLY'
      AND payment_term_days BETWEEN 1 AND 120
      AND payment_term_custom_label IS NULL
    )
    OR (
      payment_term_type = 'CUSTOM'
      AND payment_term_days IS NULL
      AND payment_term_custom_label IS NOT NULL
      AND length(btrim(payment_term_custom_label)) BETWEEN 1 AND 50
    )
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_payment_term_config_check;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_payment_term_type_check;

ALTER TABLE users
  DROP COLUMN IF EXISTS payment_term_custom_label,
  DROP COLUMN IF EXISTS payment_term_days,
  DROP COLUMN IF EXISTS payment_term_type;
-- +goose StatementEnd
