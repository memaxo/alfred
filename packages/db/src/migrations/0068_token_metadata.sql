-- Token Metadata Table
-- Stores metadata for issued API tokens to support listing and revocation

CREATE TABLE IF NOT EXISTS token_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Index for listing tokens by user
CREATE INDEX IF NOT EXISTS idx_token_metadata_user_id ON token_metadata(user_id);

-- Index for filtering active (non-revoked) tokens
CREATE INDEX IF NOT EXISTS idx_token_metadata_active ON token_metadata(user_id, revoked_at) WHERE revoked_at IS NULL;

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_token_metadata_expires ON token_metadata(expires_at) WHERE expires_at IS NOT NULL AND revoked_at IS NULL;
