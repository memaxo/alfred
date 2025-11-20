-- Migration 0002: Linear Integration
-- Create Linear OAuth installations table (workspace-centric schema)

-- Linear Installations (OAuth actor=app)
CREATE TABLE IF NOT EXISTS linear_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oauth_client_id TEXT NOT NULL,
  app_user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS linear_installations_workspace_idx
  ON linear_installations(workspace_id);

CREATE INDEX IF NOT EXISTS linear_installations_oauth_idx
  ON linear_installations(oauth_client_id);
