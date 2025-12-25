-- packages/db/migrations/0058_clarification_requests.sql
CREATE TABLE IF NOT EXISTS clarification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  phase_id TEXT,
  agent_id TEXT,
  question TEXT NOT NULL,
  options JSONB,
  response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by run_id
CREATE INDEX IF NOT EXISTS clarification_requests_run_id_idx ON clarification_requests(run_id);
