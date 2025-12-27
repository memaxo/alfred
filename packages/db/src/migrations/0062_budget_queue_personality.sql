-- Migration 0062: Budget, Queue, and Personality tables for 24/7 Thoughts System

-- ============================================================================
-- BUDGET TABLES
-- ============================================================================

-- User budget settings
CREATE TABLE IF NOT EXISTS user_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  
  -- Daily limits (null = unlimited)
  daily_dollar_limit REAL,
  daily_token_limit INTEGER,
  
  -- Per-request limits
  max_latency_ms INTEGER,
  max_tokens_per_request INTEGER,
  
  -- Model preferences per role (JSONB)
  model_preferences JSONB,
  
  -- Priority settings
  cost_priority TEXT DEFAULT 'balanced',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking (daily aggregates)
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  
  -- Token counts
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  
  -- Cost tracking (in cents)
  total_cost_cents INTEGER DEFAULT 0,
  
  -- Breakdowns (JSONB)
  provider_breakdown JSONB,
  role_breakdown JSONB,
  
  -- Request counts
  request_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for user + date
  UNIQUE (user_id, date)
);

-- Usage events (individual request logging)
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  
  -- Request details
  model_ref TEXT NOT NULL,
  provider TEXT NOT NULL,
  role TEXT NOT NULL,
  
  -- Token usage
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cached_tokens INTEGER DEFAULT 0,
  
  -- Cost (in cents)
  cost_cents INTEGER NOT NULL,
  
  -- Performance
  latency_ms INTEGER,
  
  -- Context
  workflow_run_id TEXT,
  conversation_id TEXT,
  
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Budget indexes
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON usage_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_timestamp ON usage_events(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(timestamp);

-- ============================================================================
-- TASK QUEUE TABLES
-- ============================================================================

-- Task queue
CREATE TABLE IF NOT EXISTS task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  
  -- Task definition
  type TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  payload JSONB NOT NULL,
  
  -- Source tracking
  source TEXT,
  source_id TEXT,
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  blocked_by UUID,
  
  -- Status
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  
  -- Execution tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Result
  result JSONB,
  
  -- Budget estimation
  estimated_tokens INTEGER,
  actual_tokens INTEGER,
  cost_cents INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  depends_on_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (task_id, depends_on_id)
);

-- Task execution log
CREATE TABLE IF NOT EXISTS task_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Execution details
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  
  -- Performance
  duration_ms INTEGER,
  tokens_used INTEGER,
  cost_cents INTEGER,
  
  -- Model used
  model_ref TEXT,
  
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Queue indexes
CREATE INDEX IF NOT EXISTS idx_task_queue_user_status ON task_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_task_queue_status_priority ON task_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_task_queue_scheduled ON task_queue(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_id);
CREATE INDEX IF NOT EXISTS idx_task_execution_log_task ON task_execution_log(task_id);

-- ============================================================================
-- PERSONALITY TABLES
-- ============================================================================

-- User personality traits
CREATE TABLE IF NOT EXISTS user_personality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  
  -- Personality traits (JSONB)
  traits JSONB NOT NULL,
  
  -- Computed autonomy
  effective_autonomy REAL DEFAULT 0.5,
  
  -- Timestamps
  traits_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personality calibration (per-domain accuracy tracking)
CREATE TABLE IF NOT EXISTS personality_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  
  -- Calibration metrics
  prediction_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  calibration_error REAL,
  
  -- Rolling window stats
  recent_prediction_count INTEGER DEFAULT 0,
  recent_correct_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (user_id, domain)
);

-- Personality events log
CREATE TABLE IF NOT EXISTS personality_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  trait TEXT NOT NULL,
  previous_value REAL,
  new_value REAL,
  
  -- Context
  reason TEXT,
  metadata JSONB,
  
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Personality indexes
CREATE INDEX IF NOT EXISTS idx_personality_calibration_user ON personality_calibration(user_id);
CREATE INDEX IF NOT EXISTS idx_personality_events_user ON personality_events(user_id);
CREATE INDEX IF NOT EXISTS idx_personality_events_timestamp ON personality_events(timestamp);

-- Add comment for documentation
COMMENT ON TABLE user_budgets IS 'User budget limits and model preferences for cost management';
COMMENT ON TABLE usage_tracking IS 'Daily usage aggregates for budget enforcement';
COMMENT ON TABLE task_queue IS 'Background task queue for idle-time processing';
COMMENT ON TABLE user_personality IS 'Cognitive personality traits for behavior modulation';
