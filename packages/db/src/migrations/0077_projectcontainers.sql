-- packages/db/src/migrations/0077_projectcontainers.sql
-- Track long-lived project-attached containers (AgentFS dev + deployments).

CREATE TABLE IF NOT EXISTS project_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  container_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, kind, name)
);

CREATE INDEX IF NOT EXISTS idx_project_containers_project_last_used
  ON project_containers(project_id, last_used_at DESC);
