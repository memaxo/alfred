-- Migration 0047: Update seed node confidence from 1.0 to 0.5
-- Motivation:
-- - Static ontology seeds previously had confidence=1.0, preventing learned knowledge from overriding
-- - Lowering seed confidence to 0.5 allows learned associations (confidence >= 0.8) to take precedence
-- - Adding source="seed" enables tracking which classifications come from bootstrap vs learned data

-- Update existing ontology/system nodes to confidence 0.5
-- Only update nodes that were seeded (source is null, "system", "ontology", or "seed")
UPDATE memory_nodes
SET 
  properties = jsonb_set(
    COALESCE(properties, '{}'::jsonb),
    '{confidence}',
    '0.5'::jsonb
  ),
  updated_at = NOW()
WHERE resource IN ('ontology', 'system')
  AND (
    properties->>'source' IS NULL 
    OR properties->>'source' IN ('system', 'ontology', 'seed')
  );

-- Add source: "seed" to existing ontology nodes that don't have a source
UPDATE memory_nodes
SET 
  properties = jsonb_set(
    COALESCE(properties, '{}'::jsonb),
    '{source}',
    '"seed"'::jsonb
  ),
  updated_at = NOW()
WHERE resource IN ('ontology', 'system')
  AND (properties->>'source' IS NULL OR properties->>'source' = 'system');

-- Update edge metadata to use source="seed" for consistency
UPDATE memory_edges
SET 
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{source}',
    '"seed"'::jsonb
  )
WHERE resource IN ('ontology', 'system')
  AND (metadata->>'source' IS NULL OR metadata->>'source' = 'system');
