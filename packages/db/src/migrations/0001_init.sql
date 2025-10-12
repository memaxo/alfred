-- Migration 0001: Initial Tables (RAG + Graph)
-- Create RAG and graph memory base tables

-- TODO: [Phase 3] Add indexes after table creation
-- TODO: [Phase 8] Add HNSW vector indexes for semantic search

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

-- TODO: [Phase 8] Add HNSW index for vector similarity search
-- CREATE INDEX rag_chunks_embedding_idx ON rag_chunks
-- USING hnsw (embedding vector_cosine_ops);

-- TODO: [Phase 3] Add index on document_id for chunk retrieval
-- CREATE INDEX rag_chunks_document_id_idx ON rag_chunks(document_id);

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

-- TODO: [Phase 4] Add indexes for graph traversal
-- CREATE INDEX memory_nodes_kind_idx ON memory_nodes(kind);
-- CREATE INDEX memory_edges_from_id_kind_idx ON memory_edges(from_id, kind);
-- CREATE INDEX memory_edges_to_id_kind_idx ON memory_edges(to_id, kind);
