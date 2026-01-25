/**
 * RAG Tool Execution Logic
 * Wraps @alfred/rag and @alfred/db/repo/rag functions
 */

import type { Chunk } from "@alfred/rag";

import * as ragRepo from "@alfred/db/repo/rag";
import { logger } from "@alfred/logger";
import { ingest, ingestWithOptions, retrieve } from "@alfred/rag";

import type {
  RagDeleteInput,
  RagDeleteOutput,
  RagIngestInput,
  RagIngestOutput,
  RagListInput,
  RagListOutput,
  RagQueryInput,
  RagQueryOutput,
} from "./definition.js";

const DEFAULT_K = 10;
const DEFAULT_THRESHOLD = 0.7;
const DEFAULT_LIMIT = 50;

/**
 * Execute rag_ingest - Save documents to RAG for later retrieval
 * Supports optional imageUrl for multimodal embedding via Qwen provider
 */
export async function executeIngest(
  input: RagIngestInput
): Promise<RagIngestOutput> {
  const { source, content, imageUrl, enrichGraph } = input;

  // Set env var for graph enrichment if requested
  const originalEnrichGraph = process.env.RAG_ENRICH_GRAPH;
  if (enrichGraph) {
    process.env.RAG_ENRICH_GRAPH = "1";
  }

  try {
    // Track progress for large documents
    let chunksCreated = 0;
    let documentId: string;

    // Use ingestWithOptions for multimodal support when imageUrl is provided
    if (imageUrl) {
      documentId = await ingestWithOptions({
        source,
        content,
        imageUrl,
        onProgress: (processed: number, total: number) => {
          chunksCreated = total;
          logger.debug("rag_ingest_progress", {
            source,
            processed,
            total,
            multimodal: true,
          });
        },
      });
      logger.info("rag_ingest_multimodal", {
        source,
        imageUrl: imageUrl.slice(0, 100),
      });
    } else {
      documentId = await ingest(
        source,
        content,
        (processed: number, total: number) => {
          chunksCreated = total;
          logger.debug("rag_ingest_progress", {
            source,
            processed,
            total,
          });
        }
      );
    }

    // Get actual chunk count from the database
    const chunks = await ragRepo.getChunks(documentId);
    chunksCreated = chunks.length;

    logger.info("rag_ingest_complete", {
      documentId,
      source,
      chunks: chunksCreated,
      multimodal: Boolean(imageUrl),
    });

    return {
      documentId,
      chunks: chunksCreated,
      source,
    };
  } finally {
    // Restore original env var
    if (enrichGraph) {
      if (originalEnrichGraph !== undefined) {
        process.env.RAG_ENRICH_GRAPH = originalEnrichGraph;
      } else {
        process.env.RAG_ENRICH_GRAPH = undefined;
      }
    }
  }
}

/**
 * Execute rag_query - Semantic search over the document collection
 */
export async function executeQuery(
  input: RagQueryInput
): Promise<RagQueryOutput> {
  const { query, k = DEFAULT_K, threshold = DEFAULT_THRESHOLD } = input;

  const chunks: Chunk[] = await retrieve(query, k, threshold);

  // Filter by source if specified
  const { source } = input;
  const filteredChunks = source
    ? chunks.filter((chunk) => {
        const metadata = chunk.metadata as Record<string, unknown> | undefined;
        return (
          metadata?.source === source ||
          (typeof metadata?.documentId === "string" &&
            metadata.documentId.includes(source))
        );
      })
    : chunks;

  logger.info("rag_query_complete", {
    query: query.slice(0, 100),
    k,
    threshold,
    results: filteredChunks.length,
  });

  return {
    chunks: filteredChunks.map((chunk) => {
      const metadata = chunk.metadata as Record<string, unknown> | undefined;
      return {
        content: chunk.content,
        order: chunk.order,
        metadata: {
          documentId: (metadata?.documentId as string) ?? "unknown",
          source: metadata?.source as string | undefined,
          score: (metadata?.score as number) ?? 0,
        },
      };
    }),
    total: filteredChunks.length,
  };
}

/**
 * Execute rag_list - List ingested documents
 */
export async function executeList(input: RagListInput): Promise<RagListOutput> {
  const limit = input.limit ?? DEFAULT_LIMIT;

  const documents = await ragRepo.listDocuments(limit);

  // Filter by source pattern if specified
  const filteredDocs = input.source
    ? documents.filter((doc) => {
        const sourcePattern = input.source?.toLowerCase() ?? "";
        return doc.source.toLowerCase().includes(sourcePattern);
      })
    : documents;

  // Get chunk counts for each document
  const docsWithCounts = await Promise.all(
    filteredDocs.map(async (doc) => {
      const chunks = await ragRepo.getChunks(doc.id);
      return {
        id: doc.id,
        source: doc.source,
        createdAt: doc.created?.toISOString() ?? new Date().toISOString(),
        chunkCount: chunks.length,
      };
    })
  );

  logger.info("rag_list_complete", {
    limit,
    source: input.source,
    results: docsWithCounts.length,
  });

  return {
    documents: docsWithCounts,
    total: docsWithCounts.length,
  };
}

/**
 * Execute rag_delete - Remove documents from RAG
 */
export async function executeDelete(
  input: RagDeleteInput
): Promise<RagDeleteOutput> {
  const { documentId } = input;

  // Get chunk count before deletion for reporting
  const chunks = await ragRepo.getChunks(documentId);
  const chunkCount = chunks.length;

  // Delete the document (cascade deletes chunks via FK)
  const deletedCount = await ragRepo.deleteDocument(documentId);

  const deleted = deletedCount > 0;

  logger.info("rag_delete_complete", {
    documentId,
    deleted,
    chunksRemoved: deleted ? chunkCount : 0,
  });

  return {
    deleted,
    chunksRemoved: deleted ? chunkCount : 0,
  };
}
