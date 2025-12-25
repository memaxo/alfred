-- packages/db/src/migrations/0056_workflow_plans.sql
CREATE TABLE IF NOT EXISTS workflow_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  intent TEXT NOT NULL,
  plan JSONB NOT NULL, -- StructuredPlan serialized
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, executed
  approved_at TIMESTAMPTZ,
  approved_by TEXT, -- user_id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_plans_user ON workflow_plans(user_id);
CREATE INDEX idx_workflow_plans_project ON workflow_plans(project_id);
CREATE INDEX idx_workflow_plans_status ON workflow_plans(status);
