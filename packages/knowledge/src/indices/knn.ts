import type { NodeId } from "../hypergraph.js";

const EPSILON = 1e-9;

export function cosineSim(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA <= EPSILON || magB <= EPSILON) {
    return 0;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function knn(
  vectors: Array<{ id: NodeId; vec: Float32Array }>,
  query: Float32Array,
  k = 10
): NodeId[] {
  if (vectors.length === 0 || query.length === 0) {
    return [];
  }

  const scores: Array<{ id: NodeId; score: number }> = [];
  for (const entry of vectors) {
    if (entry.vec.length !== query.length) {
      continue;
    }
    const score = cosineSim(entry.vec, query);
    if (Number.isFinite(score) && score > 0) {
      scores.push({ id: entry.id, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k).map((entry) => entry.id);
}
