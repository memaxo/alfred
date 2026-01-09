-- packages/db/src/migrations/0074_ragproject.sql
-- Attach RAG documents to projects via join table (documents remain globally deduped).

CREATE TABLE IF NOT EXISTS project_rag_documents (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_project_rag_documents_project
  ON project_rag_documents(project_id);

CREATE INDEX IF NOT EXISTS idx_project_rag_documents_document
  ON project_rag_documents(document_id);
