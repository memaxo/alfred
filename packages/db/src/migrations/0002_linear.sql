-- Migration 0002: Linear Integration
-- Create Linear OAuth installations table

-- TODO: [Phase 7] Add indexes after table creation
-- TODO: [Phase 7] Add token encryption

-- Linear Installations (OAuth actor=app)
CREATE TABLE IF NOT EXISTS linear_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- TODO: [Phase 7] Add unique constraint on (user_id, organization_id)
-- ALTER TABLE linear_installations
-- ADD CONSTRAINT linear_installations_user_org_unique UNIQUE (user_id, organization_id);

-- TODO: [Phase 7] Add index on user_id for user lookups
-- CREATE INDEX linear_installations_user_id_idx ON linear_installations(user_id);
