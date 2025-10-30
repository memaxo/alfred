ALTER TABLE memory_nodes
  ADD COLUMN IF NOT EXISTS resource TEXT,
  ADD COLUMN IF NOT EXISTS hash TEXT;

UPDATE memory_nodes
SET
  resource = COALESCE(resource, 'default'),
  hash = COALESCE(hash, md5(id::text))
WHERE
  resource IS NULL
  OR hash IS NULL;

ALTER TABLE memory_nodes
  ALTER COLUMN resource SET NOT NULL,
  ALTER COLUMN hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS memory_nodes_resource_hash_idx
  ON memory_nodes (resource, hash);

ALTER TABLE memory_edges
  ADD COLUMN IF NOT EXISTS resource TEXT,
  ADD COLUMN IF NOT EXISTS hash TEXT;

UPDATE memory_edges
SET
  resource = COALESCE(resource, 'default'),
  hash = COALESCE(hash, md5(id::text || from_id::text || to_id::text || kind))
WHERE
  resource IS NULL
  OR hash IS NULL;

ALTER TABLE memory_edges
  ALTER COLUMN resource SET NOT NULL,
  ALTER COLUMN hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS memory_edges_resource_hash_idx
  ON memory_edges (resource, hash);
