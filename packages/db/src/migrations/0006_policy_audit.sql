-- Migration 0006: Policy and Audit
-- Create audit logs and approvals tables

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trace_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  decision TEXT NOT NULL,
  obligations JSONB,
  context JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_timestamp_idx 
  ON audit_logs(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS audit_logs_trace_id_idx 
  ON audit_logs(trace_id) 
  WHERE trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_logs_action_idx 
  ON audit_logs(action);

-- Approvals Queue
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trace_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  context JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS approvals_user_id_status_idx 
  ON approvals(user_id, status);

CREATE INDEX IF NOT EXISTS approvals_expires_at_status_idx 
  ON approvals(expires_at, status) 
  WHERE expires_at IS NOT NULL;
