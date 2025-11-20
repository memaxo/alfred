-- Migration 0033: harden memory_nodes confidence index against non-numeric JSON
-- Motivation:
-- - Migration 0023 assumed that every properties->>'confidence' value was numeric
-- - Real data can contain strings like "high" or "0.9%" and would cause the cast to numeric to fail
-- - This migration rebuilds the index with a numeric guard so deployments never fail due to dirty data

DROP INDEX IF EXISTS memory_nodes_confidence_idx;

CREATE INDEX IF NOT EXISTS memory_nodes_confidence_idx
  ON memory_nodes (
    (
      CASE
        WHEN properties ? 'confidence'
          AND (properties->>'confidence') ~ '^[0-9]+(\\.[0-9]+)?$'
        THEN (properties->>'confidence')::numeric
        ELSE NULL
      END
    )
  )
  WHERE properties ? 'confidence'
    AND (properties->>'confidence') ~ '^[0-9]+(\\.[0-9]+)?$';
