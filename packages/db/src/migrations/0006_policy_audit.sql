-- Migration 0006: Policy and Audit
-- Create audit logs and approvals tables

-- TODO: [Phase 9] Add indexes after table creation

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

-- TODO: [Phase 9] Add indexes
-- CREATE INDEX audit_logs_user_id_timestamp_idx ON audit_logs(user_id, timestamp);
-- CREATE INDEX audit_logs_trace_id_idx ON audit_logs(trace_id);
-- CREATE INDEX audit_logs_action_idx ON audit_logs(action);

-- TODO: [Phase 9] Add retention policy (90 days)
-- Consider partitioning by timestamp for large scale

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

-- TODO: [Phase 9] Add indexes
-- CREATE INDEX approvals_user_id_status_idx ON approvals(user_id, status);
-- CREATE INDEX approvals_expires_at_status_idx ON approvals(expires_at, status);

-- TODO: [Phase 9] Add approval expiry cleanup job
