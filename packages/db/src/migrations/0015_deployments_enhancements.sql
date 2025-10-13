-- Migration 0015: Deployments enhancements
-- Adds domain/container metadata columns and supporting indexes.

ALTER TABLE deployments
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS container_name TEXT,
  ADD COLUMN IF NOT EXISTS ports JSONB;

CREATE INDEX IF NOT EXISTS deployments_user_app_type_idx ON deployments(user_id, app, type);
CREATE INDEX IF NOT EXISTS deployments_status_idx ON deployments(status);
CREATE INDEX IF NOT EXISTS deployments_last_health_check_idx ON deployments(last_health_check);
