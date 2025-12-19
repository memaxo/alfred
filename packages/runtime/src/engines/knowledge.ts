/**
 * Knowledge Engine Wrapper
 *
 * Wraps pure knowledge graph functions from @alfred/knowledge
 * Provides runtime context around knowledge queries
 */

import { searchChunks, searchChunksHybrid } from "@alfred/db/repo/rag";
import { findRagDocumentNode } from "@alfred/db/repo/graph/read";
import { touchNodes } from "@alfred/db/repo/graph/write";
import type { Hypergraph } from "@alfred/knowledge/hypergraph";
import { execute, parse, semanticQuery } from "@alfred/knowledge/query";
import { logger } from "@alfred/logger";
import { type Chunk, embed, rerank } from "@alfred/rag";

/**
 * KnowledgeEngine provides knowledge graph query operations
 *
 * All methods are pure - they query the graph and return results.
 * No mutations, no side effects.
 */
export class KnowledgeEngine {
  /**
   * Execute Datalog-style query
   */
  query(queryString: string, graph: Hypergraph): unknown[] {
    const query = parse(queryString);
    return execute(query, graph);
  }

  /**
   * Semantic natural language query with fallback
   */
  semanticQuery(
    naturalLanguage: string,
    graph: Hypergraph,
    topK = 5
  ): unknown[] {
    return semanticQuery(naturalLanguage, graph, topK);
  }

  /**
   * Pattern matching against graph
   */
  match(pattern: string, graph: Hypergraph): unknown[] {
    // Delegate to query module (imports match function if available)
    return execute(parse(pattern), graph);
  }

  /**
   * Retrieve context from RAG system
   *
   * Uses hybrid search (dense vector + sparse full-text) when enabled,
   * falls back to pure vector search otherwise.
   *
   * Performance budget: <10ms (p99)
   */
  async retrieveContext(
    query: string,
    options: {
      useHybrid?: boolean;
      topK?: number;
      threshold?: number;
      useReranking?: boolean;
      boostConcepts?: string[];
    } = {}
  ): Promise<Chunk[]> {
    const {
      useHybrid = true,
      topK = 10,
      threshold = 0.7,
      useReranking = false,
      boostConcepts = [],
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    // Generate query embedding
    const embedding = await embed(query);

    // Use hybrid search if enabled, otherwise pure vector search
    if (useHybrid) {
      // We fetch more candidates if reranking is enabled to allow re-ordering
      // Default limit * 3 for candidate generation
      const candidateLimit = useReranking ? topK * 3 : topK;

      let results = await searchChunksHybrid({
        embedding,
        query,
        limit: candidateLimit,
        threshold,
        boostConcepts,
        // Note: db function no longer handles reranking
      });

      if (useReranking && results.length > 0) {
        try {
          const rerankResults = await rerank({
            query,
            documents: results.map((row) => ({
              id: row.id,
              text: row.content,
            })),
            topN: topK,
            model: "rerank-v3.5",
          });

          const rerankScoreMap = new Map(
            rerankResults.map((item) => [item.id, item.score])
          );

          results = results.map((row) => {
            const rerankScore = rerankScoreMap.get(row.id) ?? 0;
            // Fusion: 0.7 * hybrid + 0.3 * rerank
            const finalScore = row.score * 0.7 + rerankScore * 0.3;
            return { ...row, score: finalScore };
          });

          // Sort by new score
          results.sort((a, b) => b.score - a.score);

          // Limit to topK
          results = results.slice(0, topK);
        } catch (_error) {
          // Continue without reranking on error
          results = results.slice(0, topK);
        }
      }

      const chunks = results.map((row) => {
        const rawMetadata = row.metadata;
        let metadata: Record<string, unknown> | undefined;

        if (rawMetadata && typeof rawMetadata === "object") {
          metadata = rawMetadata as Record<string, unknown>;
        } else if (rawMetadata !== undefined) {
          metadata = { value: rawMetadata };
        }

        return {
          content: row.content,
          order: row.order ?? 0,
          metadata: {
            ...(metadata ?? {}),
            score: row.score,
            documentId: row.documentId,
          },
        };
      });

      // Active Recall: Reinforce document nodes for retrieved chunks
      const documentIds = Array.from(
        new Set(
          chunks
            .map((c) => c.metadata?.documentId)
            .filter((id): id is string => typeof id === "string")
        )
      );

      if (documentIds.length > 0) {
        // Fire-and-forget to avoid latency
        void (async () => {
          try {
            const nodeIds: string[] = [];
            for (const documentId of documentIds) {
              const node = await findRagDocumentNode(documentId);
              if (node) {
                nodeIds.push(node.id);
              }
            }
            if (nodeIds.length > 0) {
              await touchNodes(nodeIds);
            }
          } catch (error) {
            // Non-blocking: failures don't affect retrieval
            logger.debug("knowledge_engine_active_recall_failed", {
              error: error instanceof Error ? error.message : String(error),
              documentCount: documentIds.length,
            });
          }
        })();
      }

      return chunks;
    }

    // Fallback to pure vector search via searchChunks
    const results = await searchChunks(embedding, topK, threshold);
    const chunks = results.map((row) => {
      const rawMetadata = row.metadata;
      let metadata: Record<string, unknown> | undefined;

      if (rawMetadata && typeof rawMetadata === "object") {
        metadata = rawMetadata as Record<string, unknown>;
      } else if (rawMetadata !== undefined) {
        metadata = { value: rawMetadata };
      }

      return {
        content: row.content,
        order: row.order ?? 0,
        metadata: {
          ...(metadata ?? {}),
          score: row.score,
          documentId: row.documentId,
        },
      };
    });

    // Active Recall: Reinforce document nodes for retrieved chunks
    const documentIds = Array.from(
      new Set(
        chunks
          .map((c) => c.metadata?.documentId)
          .filter((id): id is string => typeof id === "string")
      )
    );

    if (documentIds.length > 0) {
      // Fire-and-forget to avoid latency
      void (async () => {
        try {
          const nodeIds: string[] = [];
          for (const documentId of documentIds) {
            const node = await findRagDocumentNode(documentId);
            if (node) {
              nodeIds.push(node.id);
            }
          }
          if (nodeIds.length > 0) {
            await touchNodes(nodeIds);
          }
        } catch (error) {
          // Non-blocking: failures don't affect retrieval
          logger.debug("knowledge_engine_active_recall_failed", {
            error: error instanceof Error ? error.message : String(error),
            documentCount: documentIds.length,
          });
        }
      })();
    }

    return chunks;
  }
}
