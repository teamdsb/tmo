-- +goose Up
ALTER TABLE feature_flags
    ADD COLUMN IF NOT EXISTS wechat_b2b_enabled boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE feature_flags
    DROP COLUMN IF EXISTS wechat_b2b_enabled;
