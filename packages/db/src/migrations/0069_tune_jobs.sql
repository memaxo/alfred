-- Tune Jobs Table
-- Stores fine-tuning job records for progress tracking and history

CREATE TABLE IF NOT EXISTS tune_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  config JSONB NOT NULL,
  progress JSONB,
  artifacts JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for listing jobs by user
CREATE INDEX IF NOT EXISTS idx_tune_jobs_user_id ON tune_jobs(user_id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_tune_jobs_status ON tune_jobs(user_id, status);

-- Index for ordering by creation time
CREATE INDEX IF NOT EXISTS idx_tune_jobs_created ON tune_jobs(user_id, created_at DESC);

-- Constraint to ensure valid status values
ALTER TABLE tune_jobs ADD CONSTRAINT chk_tune_jobs_status 
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));
