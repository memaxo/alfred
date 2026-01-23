-- packages/db/src/migrations/0089_focus.sql
-- Concierge Focus: focus sets, commitments, attention items, delta briefs

CREATE TABLE IF NOT EXISTS focus_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, closed
  wip_limit INTEGER NOT NULL DEFAULT 5,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  last_touched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_focus_sets_user ON focus_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sets_status ON focus_sets(status);

CREATE TABLE IF NOT EXISTS focus_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  focus_set_id UUID NOT NULL REFERENCES focus_sets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, done, cancelled
  lane TEXT NOT NULL DEFAULT 'background', -- spotlight, background, maintenance
  priority INTEGER NOT NULL DEFAULT 0,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  last_touched_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_focus_commitments_user ON focus_commitments(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_commitments_focus_set ON focus_commitments(focus_set_id);
CREATE INDEX IF NOT EXISTS idx_focus_commitments_status ON focus_commitments(status);
CREATE INDEX IF NOT EXISTS idx_focus_commitments_lane ON focus_commitments(lane);
CREATE INDEX IF NOT EXISTS idx_focus_commitments_workflow_run ON focus_commitments(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_focus_commitments_conversation ON focus_commitments(conversation_id);

CREATE TABLE IF NOT EXISTS attention_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  focus_set_id UUID REFERENCES focus_sets(id) ON DELETE CASCADE,
  commitment_id UUID REFERENCES focus_commitments(id) ON DELETE SET NULL,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, acknowledged, resolved
  urgency TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, critical
  title TEXT,
  body TEXT,
  payload JSONB,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attention_items_user ON attention_items(user_id);
CREATE INDEX IF NOT EXISTS idx_attention_items_status ON attention_items(status);
CREATE INDEX IF NOT EXISTS idx_attention_items_urgency ON attention_items(urgency);
CREATE INDEX IF NOT EXISTS idx_attention_items_focus_set ON attention_items(focus_set_id);
CREATE INDEX IF NOT EXISTS idx_attention_items_commitment ON attention_items(commitment_id);
CREATE INDEX IF NOT EXISTS idx_attention_items_workflow_run ON attention_items(workflow_run_id);

CREATE TABLE IF NOT EXISTS delta_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  focus_set_id UUID REFERENCES focus_sets(id) ON DELETE CASCADE,
  commitment_id UUID REFERENCES focus_commitments(id) ON DELETE SET NULL,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  scope TEXT NOT NULL, -- focus_set, commitment, workflow_run
  since_at TIMESTAMPTZ,
  until_at TIMESTAMPTZ,
  summary_text TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delta_briefs_user ON delta_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_delta_briefs_focus_set ON delta_briefs(focus_set_id);
CREATE INDEX IF NOT EXISTS idx_delta_briefs_commitment ON delta_briefs(commitment_id);
CREATE INDEX IF NOT EXISTS idx_delta_briefs_workflow_run ON delta_briefs(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_delta_briefs_scope ON delta_briefs(scope);

