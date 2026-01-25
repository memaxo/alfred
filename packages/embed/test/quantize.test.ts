import { describe, expect, test } from "bun:test";

import {
  computeScale,
  cosineSimilarity,
  dequantizeBatch,
  dequantizeFromInt8,
  deserializeQuantized,
  EMBEDDING_DIM,
  quantizeBatch,
  quantizedCosineSimilarity,
  quantizeToInt8,
  serializeQuantized,
  storageRatio,
} from "../src/index";

/**
 * Generate a random embedding with values in typical range [-1, 1]
 */
function generateRandomEmbedding(dim: number): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}

/**
 * Generate a normalized embedding (unit vector)
 */
function generateNormalizedEmbedding(dim: number): number[] {
  const vec = generateRandomEmbedding(dim);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
}

describe("computeScale", () => {
  test("computes scale from max absolute value", () => {
    const embedding = [0.5, -0.8, 0.3, 0.9];
    const scale = computeScale(embedding);
    // Max abs is 0.9, scale = 0.9 / 127
    expect(scale).toBeCloseTo(0.9 / 127, 6);
  });

  test("handles empty embedding", () => {
    const scale = computeScale([]);
    expect(scale).toBe(1);
  });

  test("handles all-zero embedding", () => {
    const scale = computeScale([0, 0, 0, 0]);
    expect(scale).toBe(1);
  });
});

describe("quantizeToInt8", () => {
  test("quantizes embedding to int8", () => {
    const embedding = [0.5, -0.5, 0.25, -0.25];
    const quantized = quantizeToInt8(embedding);

    expect(quantized.data).toBeInstanceOf(Int8Array);
    expect(quantized.data.length).toBe(4);
    expect(quantized.dimensions).toBe(4);
    expect(quantized.scale).toBeGreaterThan(0);
  });

  test("preserves relative magnitudes", () => {
    const embedding = [1, 0.5, 0.25];
    const quantized = quantizeToInt8(embedding);

    // Largest value should map to ~127
    expect(quantized.data[0]).toBeCloseTo(127, 0);
    // Half should be ~64
    expect(quantized.data[1]).toBeCloseTo(64, 1);
    // Quarter should be ~32
    expect(quantized.data[2]).toBeCloseTo(32, 1);
  });

  test("handles negative values", () => {
    const embedding = [-1, -0.5, 0.5, 1];
    const quantized = quantizeToInt8(embedding);

    expect(quantized.data[0]).toBeCloseTo(-127, 0);
    expect(quantized.data[3]).toBeCloseTo(127, 0);
  });
});

describe("dequantizeFromInt8", () => {
  test("reconstructs approximate values", () => {
    const original = [0.8, -0.4, 0.2, -0.1];
    const quantized = quantizeToInt8(original);
    const reconstructed = dequantizeFromInt8(quantized);

    expect(reconstructed.length).toBe(original.length);

    // Each value should be close to original (within quantization error)
    for (let i = 0; i < original.length; i++) {
      expect(reconstructed[i]).toBeCloseTo(original[i], 1);
    }
  });
});

describe("round-trip accuracy", () => {
  test("maintains >97% cosine similarity for normalized embeddings", () => {
    // Test with 100 random embeddings at EMBEDDING_DIM dimensions
    const numTests = 100;
    let totalSimilarity = 0;

    for (let t = 0; t < numTests; t++) {
      const original = generateNormalizedEmbedding(EMBEDDING_DIM);
      const quantized = quantizeToInt8(original);
      const reconstructed = dequantizeFromInt8(quantized);

      const similarity = cosineSimilarity(original, reconstructed);
      totalSimilarity += similarity;

      // Each individual test should be very high
      expect(similarity).toBeGreaterThan(0.95);
    }

    const avgSimilarity = totalSimilarity / numTests;
    // Average should be >97% as per HuggingFace research
    expect(avgSimilarity).toBeGreaterThan(0.97);
  });

  test("maintains >95% similarity for unnormalized embeddings", () => {
    const numTests = 100;
    let totalSimilarity = 0;

    for (let t = 0; t < numTests; t++) {
      const original = generateRandomEmbedding(EMBEDDING_DIM);
      const quantized = quantizeToInt8(original);
      const reconstructed = dequantizeFromInt8(quantized);

      const similarity = cosineSimilarity(original, reconstructed);
      totalSimilarity += similarity;
    }

    const avgSimilarity = totalSimilarity / numTests;
    expect(avgSimilarity).toBeGreaterThan(0.95);
  });
});

describe("quantizedCosineSimilarity", () => {
  test("computes similarity directly on quantized embeddings", () => {
    const a = generateNormalizedEmbedding(128);
    const b = generateNormalizedEmbedding(128);

    const directSimilarity = cosineSimilarity(a, b);

    const qA = quantizeToInt8(a);
    const qB = quantizeToInt8(b);
    const quantizedSim = quantizedCosineSimilarity(qA, qB);

    // Quantized similarity should be close to direct similarity
    expect(quantizedSim).toBeCloseTo(directSimilarity, 1);
  });

  test("handles identical embeddings", () => {
    const embedding = generateNormalizedEmbedding(128);
    const quantized = quantizeToInt8(embedding);

    const similarity = quantizedCosineSimilarity(quantized, quantized);
    expect(similarity).toBeCloseTo(1, 2);
  });

  test("handles orthogonal embeddings", () => {
    // Create two orthogonal vectors
    const a = new Array(128).fill(0);
    const b = new Array(128).fill(0);
    a[0] = 1;
    b[1] = 1;

    const qA = quantizeToInt8(a);
    const qB = quantizeToInt8(b);

    const similarity = quantizedCosineSimilarity(qA, qB);
    expect(similarity).toBeCloseTo(0, 2);
  });
});

describe("serialization", () => {
  test("round-trips through serialization", () => {
    const original = generateNormalizedEmbedding(EMBEDDING_DIM);
    const quantized = quantizeToInt8(original);

    const serialized = serializeQuantized(quantized);
    const deserialized = deserializeQuantized(serialized);

    expect(deserialized.dimensions).toBe(quantized.dimensions);
    expect(deserialized.scale).toBeCloseTo(quantized.scale, 10);

    // Data should be identical
    for (let i = 0; i < quantized.dimensions; i++) {
      expect(deserialized.data[i]).toBe(quantized.data[i]);
    }
  });

  test("serialized size is correct", () => {
    const dim = 1024;
    const embedding = generateRandomEmbedding(dim);
    const quantized = quantizeToInt8(embedding);
    const serialized = serializeQuantized(quantized);

    // 8 bytes for scale + dim bytes for data
    expect(serialized.length).toBe(8 + dim);
  });
});

describe("batch operations", () => {
  test("quantizeBatch processes multiple embeddings", () => {
    const embeddings = [
      generateRandomEmbedding(128),
      generateRandomEmbedding(128),
      generateRandomEmbedding(128),
    ];

    const quantized = quantizeBatch(embeddings);

    expect(quantized.length).toBe(3);
    for (const q of quantized) {
      expect(q.dimensions).toBe(128);
    }
  });

  test("dequantizeBatch reconstructs all embeddings", () => {
    const embeddings = [
      generateNormalizedEmbedding(128),
      generateNormalizedEmbedding(128),
    ];

    const quantized = quantizeBatch(embeddings);
    const reconstructed = dequantizeBatch(quantized);

    expect(reconstructed.length).toBe(2);
    for (let i = 0; i < embeddings.length; i++) {
      const similarity = cosineSimilarity(embeddings[i], reconstructed[i]);
      expect(similarity).toBeGreaterThan(0.97);
    }
  });
});

describe("storageRatio", () => {
  test("calculates ~4x reduction for typical dimensions", () => {
    // For 1024 dimensions:
    // float32: 1024 * 4 = 4096 bytes
    // int8 + scale: 1024 + 8 = 1032 bytes
    // Ratio: 4096 / 1032 ≈ 3.97
    const ratio = storageRatio(1024);
    expect(ratio).toBeGreaterThan(3.9);
    expect(ratio).toBeLessThan(4.1);
  });

  test("ratio approaches 4x for large dimensions", () => {
    // As dimensions increase, overhead (8 bytes) becomes negligible
    const ratio4096 = storageRatio(4096);
    expect(ratio4096).toBeGreaterThan(3.99);
  });
});

describe("edge cases", () => {
  test("handles very small values", () => {
    const embedding = [1e-10, 1e-10, 1e-10, 1e-10];
    const quantized = quantizeToInt8(embedding);
    const reconstructed = dequantizeFromInt8(quantized);

    // Should not throw, even if precision is lost
    expect(reconstructed.length).toBe(4);
  });

  test("handles very large values", () => {
    const embedding = [1000, -1000, 500, -500];
    const quantized = quantizeToInt8(embedding);
    const reconstructed = dequantizeFromInt8(quantized);

    // Should preserve relative magnitudes
    expect(reconstructed[0]).toBeGreaterThan(reconstructed[2]);
    expect(reconstructed[1]).toBeLessThan(reconstructed[3]);
  });

  test("handles single dimension", () => {
    const embedding = [0.5];
    const quantized = quantizeToInt8(embedding);
    const reconstructed = dequantizeFromInt8(quantized);

    expect(reconstructed.length).toBe(1);
    expect(reconstructed[0]).toBeCloseTo(0.5, 1);
  });
});
