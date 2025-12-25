-- packages/db/migrations/0061_workflow_patterns_lifecycle.sql
ALTER TABLE workflow_patterns ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE workflow_patterns ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Status can be: 'active', 'quarantined', 'retired'
CREATE INDEX IF NOT EXISTS idx_patterns_status ON workflow_patterns(status);
CREATE INDEX IF NOT EXISTS idx_patterns_last_used ON workflow_patterns(last_used_at);
