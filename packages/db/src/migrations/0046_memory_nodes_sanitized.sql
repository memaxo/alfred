-- Migration 0046: Track sanitized graph nodes
-- Rationale: codex-learning should ignore legacy or unsanitized memory nodes.
-- Adds a boolean flag plus covering index so queries can filter efficiently.

ALTER TABLE memory_nodes
  ADD COLUMN IF NOT EXISTS sanitized boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS memory_nodes_sanitized_kind_resource_idx
  ON memory_nodes (sanitized, kind, resource);
