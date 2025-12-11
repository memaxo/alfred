/**
 * RAG Tool Definitions
 * Input/output schemas for RAG document management tools
 */

import { z } from "zod";

// ============================================================================
// rag_ingest - Save documents to RAG for later retrieval
// ============================================================================

export const ragIngestInputSchema = z.object({
  source: z
    .string()
    .min(1)
    .describe("Source identifier (URL, path, or descriptive name)"),
  content: z.string().min(1).describe("Document content (text)"),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional metadata to attach to the document"),
  enrichGraph: z
    .boolean()
    .optional()
    .describe("Auto-enrich knowledge graph (default: false)"),
  authz: z.string().optional().describe("Authorization token"),
});

export type RagIngestInput = z.infer<typeof ragIngestInputSchema>;

export const ragIngestOutputSchema = z.object({
  documentId: z.string(),
  chunks: z.number().describe("Number of chunks created"),
  source: z.string(),
});

export type RagIngestOutput = z.infer<typeof ragIngestOutputSchema>;

// ============================================================================
// rag_query - Semantic search over the document collection
// ============================================================================

export const ragQueryInputSchema = z.object({
  query: z.string().min(1).describe("Search query"),
  k: z.number().int().min(1).max(100).optional().describe("Top-k results"),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Similarity threshold"),
  source: z.string().optional().describe("Filter by source (optional)"),
  authz: z.string().optional().describe("Authorization token"),
});

export type RagQueryInput = z.infer<typeof ragQueryInputSchema>;

export const ragQueryOutputSchema = z.object({
  chunks: z.array(
    z.object({
      content: z.string(),
      order: z.number(),
      metadata: z.object({
        documentId: z.string(),
        source: z.string().optional(),
        score: z.number(),
      }),
    })
  ),
  total: z.number(),
});

export type RagQueryOutput = z.infer<typeof ragQueryOutputSchema>;

// ============================================================================
// rag_list - List ingested documents
// ============================================================================

export const ragListInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().describe("Max results"),
  source: z.string().optional().describe("Filter by source pattern"),
  authz: z.string().optional().describe("Authorization token"),
});

export type RagListInput = z.infer<typeof ragListInputSchema>;

export const ragListOutputSchema = z.object({
  documents: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      createdAt: z.string(),
      chunkCount: z.number(),
    })
  ),
  total: z.number(),
});

export type RagListOutput = z.infer<typeof ragListOutputSchema>;

// ============================================================================
// rag_delete - Remove documents from RAG
// ============================================================================

export const ragDeleteInputSchema = z.object({
  documentId: z.string().min(1).describe("Document ID to delete"),
  confirm: z.boolean().optional().describe("Safety confirmation flag"),
  authz: z.string().optional().describe("Authorization token"),
});

export type RagDeleteInput = z.infer<typeof ragDeleteInputSchema>;

export const ragDeleteOutputSchema = z.object({
  deleted: z.boolean(),
  chunksRemoved: z.number(),
});

export type RagDeleteOutput = z.infer<typeof ragDeleteOutputSchema>;
