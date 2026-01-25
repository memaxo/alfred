/**
 * Semantic Projection System
 *
 * Integrates knowledge graph embeddings for the semantic dimension
 * of the 4D coordinate system. Projects high-dimensional semantic
 * embeddings to 2D positions for visualization.
 */

import { cosineSimilarity } from "@alfred/embed";

import type { Point4D, Vec2 } from "./types";

// Re-export for backward compatibility
export { cosineSimilarity };

/**
 * Semantic embedding configuration
 */
export interface SemanticConfig {
  /** Embedding dimensionality (e.g., 768 for BERT, 1536 for OpenAI) */
  dimensions: number;
  /** Projection method */
  method: "pca" | "umap" | "random";
  /** Visualization scale factor */
  scale: number;
  /** Whether semantic positioning is active */
  enabled: boolean;
}

export const DEFAULT_SEMANTIC_CONFIG: SemanticConfig = {
  dimensions: 1024, // ALFRED embedding dimension
  method: "random", // Start with random, upgrade to PCA/UMAP
  scale: 100,
  enabled: true,
};

/**
 * Semantic projection state
 */
export interface SemanticState {
  /** Projection basis matrix (2 x N) stored row-major */
  basis: Float32Array;
  /** Center point for embedding space */
  center: Vec2;
  /** Cached projections by entity ID */
  projections: Map<string, Vec2>;
  /** Configuration */
  config: SemanticConfig;
}

/**
 * Create initial semantic state
 */
export function createSemanticState(
  config: Partial<SemanticConfig> = {}
): SemanticState {
  const cfg = { ...DEFAULT_SEMANTIC_CONFIG, ...config };

  // Initialize random projection basis
  const basis = createRandomBasis(cfg.dimensions);

  return {
    basis,
    center: { x: 0, y: 0 },
    projections: new Map(),
    config: cfg,
  };
}

/**
 * Create a random projection basis (2 x N matrix)
 *
 * For truly random projections, each row should be
 * orthogonal and normalized. This is a simplified version.
 */
function createRandomBasis(dimensions: number): Float32Array {
  const basis = new Float32Array(dimensions * 2);

  // Use a fixed seed for reproducibility
  let seed = 42;
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) & 0x7F_FF_FF_FF;
    return seed / 0x7F_FF_FF_FF;
  };

  // Generate random vectors
  for (let i = 0; i < dimensions * 2; i++) {
    basis[i] = (random() - 0.5) * 2;
  }

  // Normalize each row
  normalizeRow(basis, 0, dimensions);
  normalizeRow(basis, dimensions, dimensions);

  // Gram-Schmidt to make rows orthogonal
  orthogonalize(basis, dimensions);

  return basis;
}

/**
 * Normalize a row of the basis matrix
 */
function normalizeRow(
  basis: Float32Array,
  start: number,
  length: number
): void {
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += basis[start + i] * basis[start + i];
  }
  const norm = Math.sqrt(sum);
  if (norm > 0) {
    for (let i = 0; i < length; i++) {
      basis[start + i] /= norm;
    }
  }
}

/**
 * Make the second row orthogonal to the first (Gram-Schmidt)
 */
function orthogonalize(basis: Float32Array, dimensions: number): void {
  // Compute dot product of row 0 and row 1
  let dot = 0;
  for (let i = 0; i < dimensions; i++) {
    dot += basis[i] * basis[dimensions + i];
  }

  // Subtract projection of row 1 onto row 0 from row 1
  for (let i = 0; i < dimensions; i++) {
    basis[dimensions + i] -= dot * basis[i];
  }

  // Renormalize row 1
  normalizeRow(basis, dimensions, dimensions);
}

/**
 * Project an embedding to 2D position
 */
export function projectEmbedding(
  state: SemanticState,
  embedding: number[]
): Vec2 {
  if (!state.config.enabled || embedding.length === 0) {
    return { x: 0, y: 0 };
  }

  const { basis, config } = state;
  const n = Math.min(embedding.length, config.dimensions);

  let x = 0;
  let y = 0;

  for (let i = 0; i < n; i++) {
    x += embedding[i] * basis[i];
    y += embedding[i] * basis[config.dimensions + i];
  }

  return {
    x: x * config.scale + state.center.x,
    y: y * config.scale + state.center.y,
  };
}

/**
 * Project embedding and cache the result
 */
export function projectAndCache(
  state: SemanticState,
  entityId: string,
  embedding: number[]
): Vec2 {
  const cached = state.projections.get(entityId);
  if (cached) {
    return cached;
  }

  const projection = projectEmbedding(state, embedding);
  state.projections.set(entityId, projection);
  return projection;
}

/**
 * Clear projection cache
 */
export function clearProjectionCache(state: SemanticState): void {
  state.projections.clear();
}

/**
 * Update semantic center (e.g., when viewport changes)
 */
export function setSemanticCenter(state: SemanticState, center: Vec2): void {
  state.center = center;
  // Clear cache since positions are relative to center
  state.projections.clear();
}

/**
 * Create Point4D with semantic embedding
 */
export function createSemanticPoint4D(
  x: number,
  y: number,
  z: number,
  embedding: number[],
  state: SemanticState
): Point4D {
  const projection = projectEmbedding(state, embedding);

  return {
    x: x + projection.x,
    y: y + projection.y,
    z,
    t: Date.now(),
    s: embedding,
  };
}

/**
 * Find k nearest neighbors by semantic similarity
 */
export function findNearestNeighbors(
  target: number[],
  embeddings: Map<string, number[]>,
  k: number
): { id: string; similarity: number }[] {
  const similarities: { id: string; similarity: number }[] = [];

  for (const [id, embedding] of embeddings) {
    const similarity = cosineSimilarity(target, embedding);
    similarities.push({ id, similarity });
  }

  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, k);
}

/**
 * Compute centroid of embeddings
 */
export function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    return [];
  }

  const dims = embeddings[0].length;
  const centroid = new Array(dims).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dims; i++) {
      centroid[i] += embedding[i];
    }
  }

  const n = embeddings.length;
  for (let i = 0; i < dims; i++) {
    centroid[i] /= n;
  }

  return centroid;
}

/**
 * Learn PCA basis from embeddings (simplified power iteration)
 *
 * This is a simplified version - production would use proper SVD.
 */
export function learnPCABasis(
  embeddings: number[][],
  dimensions: number,
  iterations = 100
): Float32Array {
  if (embeddings.length < 2) {
    return createRandomBasis(dimensions);
  }

  // Center the data
  const centroid = computeCentroid(embeddings);
  const centered = embeddings.map((e) =>
    e.map((v, i) => v - (centroid[i] ?? 0))
  );

  // Power iteration for first principal component
  let pc1 = new Array(dimensions).fill(0).map(() => Math.random() - 0.5);
  let norm = Math.sqrt(pc1.reduce((a, b) => a + b * b, 0));
  pc1 = pc1.map((v) => v / norm);

  for (let iter = 0; iter < iterations; iter++) {
    // Multiply by covariance matrix (X^T * X * v)
    const newPc1 = new Array(dimensions).fill(0);

    for (const sample of centered) {
      const dot = sample.reduce((a, b, i) => a + b * (pc1[i] ?? 0), 0);
      for (let j = 0; j < dimensions; j++) {
        newPc1[j] += dot * (sample[j] ?? 0);
      }
    }

    // Normalize
    norm = Math.sqrt(newPc1.reduce((a, b) => a + b * b, 0));
    if (norm > 0) {
      pc1 = newPc1.map((v) => v / norm);
    }
  }

  // For second component, deflate and repeat
  const deflated = centered.map((sample) => {
    const dot = sample.reduce((a, b, i) => a + b * (pc1[i] ?? 0), 0);
    return sample.map((v, i) => v - dot * (pc1[i] ?? 0));
  });

  let pc2 = new Array(dimensions).fill(0).map(() => Math.random() - 0.5);
  norm = Math.sqrt(pc2.reduce((a, b) => a + b * b, 0));
  pc2 = pc2.map((v) => v / norm);

  for (let iter = 0; iter < iterations; iter++) {
    const newPc2 = new Array(dimensions).fill(0);

    for (const sample of deflated) {
      const dot = sample.reduce((a, b, i) => a + b * (pc2[i] ?? 0), 0);
      for (let j = 0; j < dimensions; j++) {
        newPc2[j] += dot * (sample[j] ?? 0);
      }
    }

    norm = Math.sqrt(newPc2.reduce((a, b) => a + b * b, 0));
    if (norm > 0) {
      pc2 = newPc2.map((v) => v / norm);
    }
  }

  // Combine into basis matrix
  const basis = new Float32Array(dimensions * 2);
  for (let i = 0; i < dimensions; i++) {
    basis[i] = pc1[i] ?? 0;
    basis[dimensions + i] = pc2[i] ?? 0;
  }

  return basis;
}

/**
 * Update semantic state with learned basis
 */
export function updateSemanticBasis(
  state: SemanticState,
  embeddings: number[][]
): void {
  if (state.config.method === "pca" && embeddings.length >= 10) {
    state.basis = learnPCABasis(embeddings, state.config.dimensions);
    state.projections.clear();
  }
}
