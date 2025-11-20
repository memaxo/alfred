-- Migration 0004: Deployments
-- Create deployments tracking table

-- Deployments
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  app TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'preview',
  status TEXT NOT NULL DEFAULT 'pending',
  url TEXT,
  branch TEXT,
  commit TEXT,
  container_id TEXT,
  lxc_id TEXT,
  port INTEGER,
  health_url TEXT,
  last_health_check TIMESTAMPTZ,
  health_status TEXT,
  domain TEXT,
  container_name TEXT,
  ports JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  metadata JSONB
);

-- Indexes for deployments queries
CREATE INDEX IF NOT EXISTS deployments_user_app_type_idx ON deployments(user_id, app, type);
CREATE INDEX IF NOT EXISTS deployments_status_idx ON deployments(status);
CREATE INDEX IF NOT EXISTS deployments_last_health_check_idx ON deployments(last_health_check);
