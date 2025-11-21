/**
 * ALFRED RAG Schema
 * Documents and chunks with pgvector embeddings
 */

// Import embedding dimension from embed package (single source of truth)
// KaLM-Embedding-Gemma3-12B-2511 with MRL truncation to 1024 dimensions
import { EMBEDDING_DIM } from "@alfred/embed";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const VECTOR_DIM = EMBEDDING_DIM;

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

// Unique index on source (0034) deduplicates single-user document ingest

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
