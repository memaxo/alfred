-- Align chat message IDs with AI SDK (string IDs).
-- AI SDK message ids are not UUIDs; storing them as uuid breaks persistence.

ALTER TABLE messages
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE messages
  ALTER COLUMN id TYPE TEXT
  USING id::text;

