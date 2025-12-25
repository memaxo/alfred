-- packages/db/migrations/0059_workflow_patterns.sql
CREATE TABLE IF NOT EXISTS workflow_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL,
  plan_template JSONB NOT NULL,
  success_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  avg_duration_ms BIGINT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  knowledge_node_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_patterns_trigger ON workflow_patterns(trigger);
CREATE INDEX IF NOT EXISTS idx_patterns_project ON workflow_patterns(project_id);
CREATE INDEX IF NOT EXISTS idx_patterns_success ON workflow_patterns(success_rate);
