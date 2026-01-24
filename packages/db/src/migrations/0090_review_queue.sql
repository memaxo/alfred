-- packages/db/src/migrations/0090_review_queue.sql
-- ALFRED Reviews: Swipe-based AI action validation and code review

CREATE TABLE IF NOT EXISTS review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  
  -- What's being reviewed
  review_type TEXT NOT NULL, -- 'tool_execution', 'message', 'memory', 'workflow', 'code'
  subject_id TEXT NOT NULL, -- ID of the action being reviewed
  subject_data JSONB NOT NULL, -- Snapshot of the action/output data
  
  -- Code review specific fields
  code_source TEXT, -- 'github_pr', 'local_diff', 'agent_output'
  pr_number INTEGER,
  pr_url TEXT,
  repository TEXT,
  bug_count INTEGER DEFAULT 0,
  quality_score REAL,
  
  -- Context
  conversation_id TEXT,
  message_id TEXT,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Priority and auto-approve
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  auto_approve_eligible BOOLEAN DEFAULT FALSE,
  confidence REAL DEFAULT 0.5, -- Confidence score of the action (0-1)
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'skipped', 'expired'
  reviewed_at TIMESTAMPTZ,
  verdict_data JSONB, -- Correction details if rejected
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Auto-approve or expire after this time
  
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT valid_review_type CHECK (review_type IN ('tool_execution', 'message', 'memory', 'workflow', 'code')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'skipped', 'expired'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_review_queue_user_status ON review_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_review_queue_priority ON review_queue(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_queue_type ON review_queue(review_type);
CREATE INDEX IF NOT EXISTS idx_review_queue_pending ON review_queue(user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_review_queue_pr ON review_queue(pr_number) WHERE pr_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_queue_bugs ON review_queue(bug_count DESC) WHERE review_type = 'code';
CREATE INDEX IF NOT EXISTS idx_review_queue_workflow ON review_queue(workflow_run_id) WHERE workflow_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_queue_conversation ON review_queue(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_queue_project ON review_queue(project_id) WHERE project_id IS NOT NULL;

-- Unique constraint to prevent duplicate reviews for same subject
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_queue_unique_subject ON review_queue(user_id, subject_id, review_type) WHERE status = 'pending';

-- Review analytics table for tracking patterns
CREATE TABLE IF NOT EXISTS review_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  
  -- Time period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Counts by type
  tool_approved INTEGER DEFAULT 0,
  tool_rejected INTEGER DEFAULT 0,
  memory_approved INTEGER DEFAULT 0,
  memory_rejected INTEGER DEFAULT 0,
  message_approved INTEGER DEFAULT 0,
  message_rejected INTEGER DEFAULT 0,
  workflow_approved INTEGER DEFAULT 0,
  workflow_rejected INTEGER DEFAULT 0,
  code_approved INTEGER DEFAULT 0,
  code_rejected INTEGER DEFAULT 0,
  
  -- Totals
  total_reviewed INTEGER DEFAULT 0,
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  total_skipped INTEGER DEFAULT 0,
  
  -- Timing
  avg_review_time_ms INTEGER,
  
  -- Auto-approve stats
  auto_approved INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_analytics_user ON review_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_review_analytics_period ON review_analytics(period_start, period_end);

-- Auto-approve patterns table
CREATE TABLE IF NOT EXISTS review_auto_approve_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  
  -- Pattern definition
  review_type TEXT NOT NULL,
  pattern_key TEXT NOT NULL, -- e.g., 'tool:note_create' or 'memory:preference:meeting_time'
  pattern_data JSONB, -- Additional pattern matching data
  
  -- Approval history
  approval_count INTEGER DEFAULT 0,
  rejection_count INTEGER DEFAULT 0,
  last_approval_at TIMESTAMPTZ,
  
  -- Status
  enabled BOOLEAN DEFAULT FALSE,
  enabled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_pattern UNIQUE (user_id, review_type, pattern_key)
);

CREATE INDEX IF NOT EXISTS idx_review_patterns_user ON review_auto_approve_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_review_patterns_enabled ON review_auto_approve_patterns(user_id, enabled) WHERE enabled = TRUE;
