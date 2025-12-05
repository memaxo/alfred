-- Migration 0048: Add quantized embedding storage
-- Purpose: Enable int8 quantization for ~4x storage reduction with 97%+ accuracy retention
-- Reference: alfred-memory-review.md - "Int8 quantization achieves 4x memory reduction"

-- Add quantized embedding column to memory_nodes
-- Stores serialized QuantizedEmbedding (8-byte scale + int8 data)
ALTER TABLE memory_nodes
ADD COLUMN IF NOT EXISTS embedding_quantized bytea;

-- Add index for efficient null checking (to find nodes needing quantization)
CREATE INDEX IF NOT EXISTS memory_nodes_embedding_quantized_null_idx
  ON memory_nodes (id)
  WHERE embedding IS NOT NULL AND embedding_quantized IS NULL;

-- Comment explaining the format
COMMENT ON COLUMN memory_nodes.embedding_quantized IS 
  'Int8 quantized embedding: first 8 bytes are float64 scale factor, remaining bytes are signed int8 values. Use for storage efficiency; use embedding column for search.';
