-- Metric Alerts Table
-- Stores user-configured metric alerts for the metrics dashboard

CREATE TABLE IF NOT EXISTS metric_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  condition TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  enabled BOOLEAN DEFAULT TRUE NOT NULL,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for listing alerts by user
CREATE INDEX IF NOT EXISTS idx_metric_alerts_user_id ON metric_alerts(user_id);

-- Index for enabled alerts (for scheduler)
CREATE INDEX IF NOT EXISTS idx_metric_alerts_enabled ON metric_alerts(enabled) WHERE enabled = TRUE;

-- Constraint to ensure valid severity values
ALTER TABLE metric_alerts ADD CONSTRAINT chk_metric_alerts_severity 
  CHECK (severity IN ('info', 'warning', 'critical'));
