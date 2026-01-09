-- Migration 0080: Personalization and Operational Project Scoping
-- Add project_id to user_preferences, user_facts, user_events, audit_logs, tune_jobs, metric_alerts, user_feedback

-- User Preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS user_preferences_project_id_idx ON user_preferences (project_id);

-- Update uniqueness for preferences to include project_id
DROP INDEX IF EXISTS user_preferences_user_key_idx;
CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_key_project_idx ON user_preferences (user_id, key, project_id);
-- Note: In PG15+ we could use UNIQUE NULLS NOT DISTINCT, but for now we accept standard NULL behavior 
-- (one global preference + one per project is supported naturally).

-- User Facts
ALTER TABLE user_facts ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS user_facts_project_id_idx ON user_facts (project_id);

-- User Events
ALTER TABLE user_events ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS user_events_project_id_idx ON user_events (project_id);

-- Audit Logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS audit_logs_project_id_idx ON audit_logs (project_id);

-- Tune Jobs
ALTER TABLE tune_jobs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tune_jobs_project_id_idx ON tune_jobs (project_id);

-- Metric Alerts
ALTER TABLE metric_alerts ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS metric_alerts_project_id_idx ON metric_alerts (project_id);

-- User Feedback
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS user_feedback_project_id_idx ON user_feedback (project_id);
