/**
 * ALFRED RAG Schema
 * Documents and chunks with pgvector embeddings
 */

import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// TODO: [Phase 8] Add proper indexes for performance
// TODO: [Phase 8] Add HNSW vector indexes for semantic search

export const VECTOR_DIM = 1536;

/**
 * RAG documents (source documents)
 */
export const ragDocuments = pgTable("rag_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull(), // URL, file path, or identifier
  title: text("title"),
  author: text("author"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"), // Arbitrary metadata (tags, categories, etc.)
});

// TODO: [Phase 8] Add index on source for deduplication

/**
 * RAG chunks (chunked text with embeddings)
 */
export const ragChunks = pgTable("rag_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => ragDocuments.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  order: integer("order").notNull().default(0), // Chunk order within document
  embedding: vector("embedding", { dimensions: VECTOR_DIM }),
  metadata: jsonb("metadata"), // Chunk-level metadata (section, page, etc.)
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// TODO: [Phase 8] Add HNSW vector index for ragChunks.embedding
// CREATE INDEX ON rag_chunks USING hnsw (embedding vector_cosine_ops);

// TODO: [Phase 8] Add index on (documentId, order) for ordered retrieval
