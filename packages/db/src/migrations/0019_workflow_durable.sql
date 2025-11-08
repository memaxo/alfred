-- Migration 0019: Workflow durable execution
-- Add workflow_runs and workflow_events tables for durable execution

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled'
  input_data JSONB,
  state_data JSONB, -- Current workflow state
  webhook_url TEXT, -- Webhook URL for resume
  webhook_secret TEXT, -- Secret for webhook verification
  suspended_at TIMESTAMPTZ, -- When workflow was suspended
  resumed_at TIMESTAMPTZ, -- When workflow was resumed
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_runs_user_status_idx
  ON workflow_runs (user_id, status);

CREATE INDEX IF NOT EXISTS workflow_runs_webhook_idx
  ON workflow_runs (webhook_url) WHERE webhook_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'step_start' | 'step_complete' | 'suspend' | 'resume' | 'error'
  event_data JSONB,
  step_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_events_run_id_idx
  ON workflow_events (run_id, timestamp);

CREATE INDEX IF NOT EXISTS workflow_events_step_id_idx
  ON workflow_events (step_id) WHERE step_id IS NOT NULL;

