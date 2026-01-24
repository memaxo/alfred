-- Review templates table for pre-defined rejection/approval responses
CREATE TABLE IF NOT EXISTS review_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  
  -- Template definition
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('rejection', 'approval', 'request_changes')),
  review_type TEXT CHECK (review_type IN ('tool_execution', 'message', 'memory', 'workflow', 'code')),
  
  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  suggested_correction JSONB,
  
  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_review_templates_user ON review_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_review_templates_type ON review_templates(template_type, review_type);

-- Insert default templates
INSERT INTO review_templates (user_id, name, template_type, title, message, is_default) VALUES
  ('system', 'Security Concern', 'rejection', 'Security Risk Detected', 'This action has been rejected due to potential security implications. Please review the agent''s proposed changes and ensure no sensitive data is exposed.', true),
  ('system', 'Scope Exceeded', 'rejection', 'Exceeds Approved Scope', 'This action goes beyond the approved scope of the current task. Please narrow the agent''s focus or expand the task definition.', true),
  ('system', 'Quality Issue', 'rejection', 'Quality Standards Not Met', 'The proposed changes do not meet quality standards. Please request improvements before proceeding.', true),
  ('system', 'Needs Clarification', 'request_changes', 'Additional Context Required', 'More information is needed before this action can be approved. Please provide additional context about the intended outcome.', true),
  ('system', 'LGTM', 'approval', 'Approved', 'This action has been reviewed and approved. The agent may proceed with implementation.', true)
ON CONFLICT DO NOTHING;
