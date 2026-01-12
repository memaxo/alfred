-- packages/db/src/migrations/0081_mcp.sql
-- Outbound MCP server configurations (ALFRED as MCP client).

CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  transport TEXT NOT NULL DEFAULT 'http',
  url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'none',
  auth JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, label)
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_enabled
  ON mcp_servers(user_id)
  WHERE enabled = true;

