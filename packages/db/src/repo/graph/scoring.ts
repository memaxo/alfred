/**
 * Graph Retrieval Scoring and Filtering
 *
 * Implements top-K retrieval with downstream filtering instead of static thresholds.
 * Reference: alfred-memory-review.md - "Top-K retrieval outperforms static thresholds"
 */

import type { NodeRow } from "./types";

/**
 * Default top-K value for retrieval operations.
 * Retrieve K candidates then filter/rerank downstream.
 */
export const DEFAULT_TOP_K = 20;

/**
 * Minimum score for final filtering after top-K retrieval.
 * Much lower than previous threshold since we're filtering post-retrieval.
 */
export const DEFAULT_MIN_SCORE = 0.3;

/**
 * Retrieval scoring options
 */
export type ScoringOptions = {
  /** Number of candidates to retrieve (default: 20) */
  topK?: number;
  /** Minimum score for final results (default: 0.3) */
  minScore?: number;
  /** Optional recency weight (0-1, default: 0.1) */
  recencyWeight?: number;
  /** Optional access count weight (0-1, default: 0.05) */
  accessWeight?: number;
};

/**
 * Scored result with relevance score
 */
export type ScoredResult<T> = {
  item: T;
  score: number;
  matchType: "exact" | "semantic" | "fuzzy" | "hybrid";
};

/**
 * Compute cosine similarity between two vectors.
 * Returns value in range [-1, 1] where 1 is most similar.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Compute relevance score for a node given a query embedding.
 * Combines semantic similarity with optional recency and access boosts.
 *
 * @param node - The node to score
 * @param queryEmbedding - Query embedding for semantic comparison
 * @param options - Scoring options
 * @returns Relevance score in range [0, 1]
 */
export function computeRelevanceScore(
  node: NodeRow,
  queryEmbedding: number[] | undefined,
  options: ScoringOptions = {}
): number {
  const recencyWeight = options.recencyWeight ?? 0.1;
  const accessWeight = options.accessWeight ?? 0.05;

  let baseScore = 0;

  // Semantic similarity (primary factor)
  if (queryEmbedding && node.embedding) {
    const nodeEmbedding = normalizeEmbedding(node.embedding);
    if (nodeEmbedding) {
      const similarity = cosineSimilarity(queryEmbedding, nodeEmbedding);
      // Convert from [-1, 1] to [0, 1]
      baseScore = (similarity + 1) / 2;
    }
  } else {
    // No embedding available, use default score
    baseScore = 0.5;
  }

  // Recency boost (newer = higher score)
  let recencyBoost = 0;
  if (node.updated && recencyWeight > 0) {
    const ageMs = Date.now() - new Date(node.updated).getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    // Exponential decay: score = 1 at 0 days, 0.5 at 7 days, 0.25 at 14 days
    recencyBoost = Math.exp(-ageDays / 10) * recencyWeight;
  }

  // Access frequency boost (more accessed = higher score)
  let accessBoost = 0;
  if (node.accessCount && accessWeight > 0) {
    // Logarithmic boost: diminishing returns for very high access counts
    accessBoost = (Math.log(1 + node.accessCount) / 10) * accessWeight;
  }

  // Combine scores with weights
  const totalWeight = 1 - recencyWeight - accessWeight;
  const finalScore = baseScore * totalWeight + recencyBoost + accessBoost;

  return Math.max(0, Math.min(1, finalScore));
}

/**
 * Filter and rerank results by minimum score.
 *
 * @param results - Scored results to filter
 * @param minScore - Minimum score threshold
 * @returns Filtered results above threshold, sorted by score
 */
export function filterByMinScore<T>(
  results: ScoredResult<T>[],
  minScore: number = DEFAULT_MIN_SCORE
): ScoredResult<T>[] {
  return results
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

/**
 * Select top-K results from a list.
 *
 * @param results - Results to select from
 * @param k - Number of results to return
 * @returns Top K results sorted by score
 */
export function selectTopK<T>(
  results: ScoredResult<T>[],
  k: number = DEFAULT_TOP_K
): ScoredResult<T>[] {
  return results.sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Score and rank nodes by relevance to a query.
 * Implements the top-K + filtering pattern.
 *
 * @param nodes - Candidate nodes to score
 * @param queryEmbedding - Query embedding for semantic comparison
 * @param options - Scoring and filtering options
 * @returns Scored and filtered results
 */
export function scoreAndRankNodes(
  nodes: NodeRow[],
  queryEmbedding: number[] | undefined,
  options: ScoringOptions = {}
): ScoredResult<NodeRow>[] {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  // Score all nodes
  const scored: ScoredResult<NodeRow>[] = nodes.map((node) => ({
    item: node,
    score: computeRelevanceScore(node, queryEmbedding, options),
    matchType: queryEmbedding && node.embedding ? "semantic" : "fuzzy",
  }));

  // Select top-K
  const topResults = selectTopK(scored, topK);

  // Filter by minimum score
  return filterByMinScore(topResults, minScore);
}

/**
 * Normalize embedding from various storage formats to number[].
 */
function normalizeEmbedding(value: unknown): number[] | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const nums = value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry));
    return nums.length > 0 ? nums : null;
  }

  if (value instanceof Uint8Array) {
    if (value.byteLength % 4 !== 0) {
      return null;
    }
    const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
    const result: number[] = [];
    for (let offset = 0; offset < view.byteLength; offset += 4) {
      result.push(view.getFloat32(offset, true));
    }
    return result.length > 0 ? result : null;
  }

  if (value instanceof ArrayBuffer) {
    const arr = Array.from(new Float32Array(value));
    return arr.length > 0 ? arr : null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const nums = parsed
          .map((entry) => Number(entry))
          .filter((entry) => Number.isFinite(entry));
        return nums.length > 0 ? nums : null;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Hybrid scoring that combines semantic and text-based matching.
 * Useful when query may be a label/keyword rather than embedded query.
 *
 * @param node - Node to score
 * @param queryText - Query text for fuzzy matching
 * @param queryEmbedding - Query embedding for semantic matching
 * @param options - Scoring options
 * @returns Combined score
 */
export function computeHybridScore(
  node: NodeRow,
  queryText: string | undefined,
  queryEmbedding: number[] | undefined,
  options: ScoringOptions = {}
): ScoredResult<NodeRow> {
  let semanticScore = 0;
  let textScore = 0;
  let matchType: ScoredResult<NodeRow>["matchType"] = "fuzzy";

  // Semantic scoring
  if (queryEmbedding && node.embedding) {
    semanticScore = computeRelevanceScore(node, queryEmbedding, options);
    matchType = "semantic";
  }

  // Text-based scoring
  if (queryText && node.label) {
    const normalizedQuery = queryText.toLowerCase().trim();
    const normalizedLabel = node.label.toLowerCase().trim();

    if (normalizedLabel === normalizedQuery) {
      textScore = 1.0;
      matchType = "exact";
    } else if (normalizedLabel.includes(normalizedQuery)) {
      textScore = 0.8;
      matchType = matchType === "semantic" ? "hybrid" : "fuzzy";
    } else if (normalizedQuery.includes(normalizedLabel)) {
      textScore = 0.6;
      matchType = matchType === "semantic" ? "hybrid" : "fuzzy";
    }
  }

  // Combine scores (prefer exact matches)
  const score =
    matchType === "exact" ? 1.0 : Math.max(semanticScore, textScore * 0.9);

  return { item: node, score, matchType };
}
