/**
 * Knowledge Engine Wrapper
 * 
 * Wraps pure knowledge graph functions from @alfred/knowledge
 * Provides runtime context around knowledge queries
 */

import { parse, execute, semanticQuery } from "@alfred/knowledge/query";
import type { Hypergraph } from "@alfred/knowledge/hypergraph";

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
  semanticQuery(naturalLanguage: string, graph: Hypergraph, topK = 5): unknown[] {
    return semanticQuery(naturalLanguage, graph, topK);
  }

  /**
   * Pattern matching against graph
   */
  match(pattern: string, graph: Hypergraph): unknown[] {
    // Delegate to query module (imports match function if available)
    return execute(parse(pattern), graph);
  }
}

