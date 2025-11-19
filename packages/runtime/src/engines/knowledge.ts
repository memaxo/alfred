/**
 * Knowledge Engine Wrapper
 *
 * Wraps pure knowledge graph functions from @alfred/knowledge
 * Provides runtime context around knowledge queries
 */

import { searchChunksHybrid } from "@alfred/db/repo/rag";
import type { Hypergraph } from "@alfred/knowledge/hypergraph";
import { execute, parse, semanticQuery } from "@alfred/knowledge/query";
import { type Chunk, embed, retrieve } from "@alfred/rag";

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
    } = {}
  ): Promise<Chunk[]> {
    const {
      useHybrid = true,
      topK = 10,
      threshold = 0.7,
      useReranking = false,
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    // Generate query embedding
    const embedding = await embed(query);

    // Use hybrid search if enabled, otherwise pure vector search
    if (useHybrid) {
      const results = await searchChunksHybrid({
        embedding,
        query,
        limit: topK,
        threshold,
        useReranking,
      });

      return results.map((row) => {
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
    }

    // Fallback to pure vector search via retrieve()
    return retrieve(query, topK, threshold);
  }
}
