import { cosineSimilarity } from "@alfred/embed";

import type { NodeId } from "../hypergraph.js";

/**
 * Compute cosine similarity for Float32Array inputs.
 * Delegates to the canonical implementation in @alfred/embed.
 */
export function cosineSim(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  return cosineSimilarity([...a], [...b]);
}

export function knn(
  vectors: { id: NodeId; vec: Float32Array }[],
  query: Float32Array,
  k = 10
): NodeId[] {
  if (vectors.length === 0 || query.length === 0) {
    return [];
  }

  const queryArr = [...query];
  const scores: { id: NodeId; score: number }[] = [];

  for (const entry of vectors) {
    if (entry.vec.length !== query.length) {
      continue;
    }
    const score = cosineSimilarity([...entry.vec], queryArr);
    if (Number.isFinite(score) && score > 0) {
      scores.push({ id: entry.id, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k).map((entry) => entry.id);
}
