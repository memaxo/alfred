-- packages/db/src/migrations/0055_projects.sql
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  workspace TEXT NOT NULL,
  linear_project_id TEXT,
  linear_team_id TEXT,
  config JSONB DEFAULT '{}',
  conventions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  
  UNIQUE(user_id, workspace),
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX idx_projects_user_workspace ON projects(user_id, workspace);
CREATE INDEX idx_projects_linear_project ON projects(linear_project_id) WHERE linear_project_id IS NOT NULL;
