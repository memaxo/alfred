-- Migration 0042: Deploy schema performance indexes
-- Accelerates deployment list, health monitoring, and stale detection queries

-- Index for app queries grouped by user/app/type
CREATE INDEX IF NOT EXISTS deployments_user_app_type_idx 
  ON deployments(user_id, app, type);

-- Index for health monitoring on active/stalled deployments
CREATE INDEX IF NOT EXISTS deployments_status_idx 
  ON deployments(status) 
  WHERE status IN ('running', 'failed', 'stopped');

-- Index for stale deployment detection via last health check
CREATE INDEX IF NOT EXISTS deployments_last_health_check_idx 
  ON deployments(last_health_check) 
  WHERE last_health_check IS NOT NULL;
