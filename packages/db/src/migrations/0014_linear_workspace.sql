-- Migration 0014: Align linear_installations with workspace-centric schema

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'linear_installations_user_org_unique'
      AND table_name = 'linear_installations'
  ) THEN
    ALTER TABLE linear_installations
      DROP CONSTRAINT linear_installations_user_org_unique;
  END IF;
END $$;

ALTER TABLE linear_installations
  ADD COLUMN IF NOT EXISTS oauth_client_id TEXT,
  ADD COLUMN IF NOT EXISTS app_user_id TEXT,
  ADD COLUMN IF NOT EXISTS workspace_id TEXT;

UPDATE linear_installations
SET
  oauth_client_id = COALESCE(oauth_client_id, organization_id, 'legacy_oauth_client'),
  app_user_id = COALESCE(app_user_id, user_id, 'legacy_app_user'),
  workspace_id = COALESCE(workspace_id, organization_id, 'legacy_workspace')
WHERE oauth_client_id IS NULL
   OR app_user_id IS NULL
   OR workspace_id IS NULL;

ALTER TABLE linear_installations
  ALTER COLUMN oauth_client_id SET NOT NULL,
  ALTER COLUMN app_user_id SET NOT NULL,
  ALTER COLUMN workspace_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS linear_installations_workspace_idx
  ON linear_installations(workspace_id);

CREATE INDEX IF NOT EXISTS linear_installations_oauth_idx
  ON linear_installations(oauth_client_id);

ALTER TABLE linear_installations
  DROP COLUMN IF EXISTS user_id,
  DROP COLUMN IF EXISTS organization_id;
