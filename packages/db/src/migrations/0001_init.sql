-- Migration 0001: Initial Tables (RAG + Graph)
-- Create RAG and graph memory base tables

-- RAG Documents
CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  title TEXT,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS rag_documents_source_idx 
  ON rag_documents(source);

-- RAG Chunks with embeddings
CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory Nodes (Knowledge graph entities)
CREATE TABLE IF NOT EXISTS memory_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  properties JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory Edges (Knowledge graph relationships)
CREATE TABLE IF NOT EXISTS memory_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Graph traversal indexes
CREATE INDEX IF NOT EXISTS memory_nodes_kind_created_idx
  ON memory_nodes (kind, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_edges_from_kind_created_idx
  ON memory_edges (from_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_edges_to_kind_created_idx
  ON memory_edges (to_id, kind, created_at DESC);
