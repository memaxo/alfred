-- Review Dependencies Migration
-- Tracks which reviews block other work items

-- Dependency types
-- - blocks_workflow: Review blocks a workflow step
-- - blocks_task: Review blocks a task completion
-- - blocks_pr: Review blocks PR merge
-- - blocks_deploy: Review blocks deployment
-- - related: Reviews are related but not blocking

CREATE TABLE IF NOT EXISTS review_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The review that is blocking
  review_id UUID NOT NULL REFERENCES review_queue(id) ON DELETE CASCADE,
  
  -- What is blocked
  blocked_type TEXT NOT NULL, -- 'workflow' | 'task' | 'pr' | 'deploy' | 'review'
  blocked_id TEXT NOT NULL, -- ID of the blocked item
  blocked_label TEXT, -- Human-readable label
  
  -- Dependency metadata
  dependency_type TEXT NOT NULL DEFAULT 'blocks', -- 'blocks' | 'related' | 'parent'
  is_critical_path BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  -- Ensure no duplicate dependencies
  UNIQUE(review_id, blocked_type, blocked_id)
);

-- Index for fast lookup by review
CREATE INDEX idx_review_dependencies_review_id ON review_dependencies(review_id);

-- Index for finding what's blocked
CREATE INDEX idx_review_dependencies_blocked ON review_dependencies(blocked_type, blocked_id);

-- Index for unresolved dependencies
CREATE INDEX idx_review_dependencies_unresolved ON review_dependencies(review_id) WHERE resolved_at IS NULL;

-- Review audit log for compliance tracking
CREATE TABLE IF NOT EXISTS review_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Review reference
  review_id UUID NOT NULL REFERENCES review_queue(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  
  -- Action details
  action TEXT NOT NULL, -- 'created' | 'approved' | 'rejected' | 'skipped' | 'delegated' | 'expired'
  action_data JSONB, -- Additional action-specific data
  
  -- Context
  ip_address TEXT,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit log queries
CREATE INDEX idx_review_audit_log_review_id ON review_audit_log(review_id);
CREATE INDEX idx_review_audit_log_user_id ON review_audit_log(user_id);
CREATE INDEX idx_review_audit_log_action ON review_audit_log(action);
CREATE INDEX idx_review_audit_log_created_at ON review_audit_log(created_at);

-- Add delegation fields to review_queue
ALTER TABLE review_queue 
  ADD COLUMN IF NOT EXISTS delegated_to TEXT,
  ADD COLUMN IF NOT EXISTS delegated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delegated_by TEXT;

-- Index for delegated reviews
CREATE INDEX idx_review_queue_delegated_to ON review_queue(delegated_to) WHERE delegated_to IS NOT NULL;
