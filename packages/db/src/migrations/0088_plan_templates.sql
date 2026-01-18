-- Plan Templates
-- Reusable plan templates for common workflow patterns

CREATE TABLE IF NOT EXISTS plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_pattern TEXT,  -- Regex or semantic match pattern
  plan_data JSONB NOT NULL,  -- Serialized StructuredPlan
  success_rate DECIMAL(5,2),  -- Percentage 0-100
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plan_templates_user ON plan_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_templates_trigger ON plan_templates(trigger_pattern) WHERE trigger_pattern IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_templates_usage ON plan_templates(usage_count DESC, success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_plan_templates_created ON plan_templates(created_at DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_plan_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_templates_updated_at
  BEFORE UPDATE ON plan_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_templates_updated_at();
