-- Migration 0041: Policy schema performance indexes
-- Covers audit trail, trace correlation, action filtering, and approvals queue

-- Index for user audit trail queries ordered by recency
CREATE INDEX IF NOT EXISTS audit_logs_user_timestamp_idx 
  ON audit_logs(user_id, timestamp DESC);

-- Index for trace correlation lookups (sparse field)
CREATE INDEX IF NOT EXISTS audit_logs_trace_id_idx 
  ON audit_logs(trace_id) 
  WHERE trace_id IS NOT NULL;

-- Index for action type filtering across audit logs
CREATE INDEX IF NOT EXISTS audit_logs_action_idx 
  ON audit_logs(action);

-- Index for pending approval queries scoped by user
CREATE INDEX IF NOT EXISTS approvals_user_status_idx 
  ON approvals(user_id, status) 
  WHERE status = 'pending';

-- Index for expiry cleanup on approvals
CREATE INDEX IF NOT EXISTS approvals_expires_status_idx 
  ON approvals(expires_at, status) 
  WHERE expires_at IS NOT NULL;
