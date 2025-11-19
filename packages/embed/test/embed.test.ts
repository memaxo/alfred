/**
 * Embedding Package Tests
 * Tests local KaLM-Embedding model integration
 */

import { describe, test, expect, afterAll } from "bun:test";
import { embed, embedMany, EMBEDDING_DIM, shutdown } from "../src/index";

describe("Embed Package", () => {
  afterAll(async () => {
    await shutdown();
  });

  test("EMBEDDING_DIM is 1024 (MRL truncation)", () => {
    expect(EMBEDDING_DIM).toBe(1024);
  });

  test("embed() returns 1024-dim vector", async () => {
    const embedding = await embed("This is a test sentence for embedding.");

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(EMBEDDING_DIM);
    expect(embedding.length).toBe(1024);
    expect(embedding.every((n) => typeof n === "number")).toBe(true);
    expect(embedding.every((n) => Number.isFinite(n))).toBe(true);
  }, 90_000); // 90s timeout for model loading on first call

  test("embedMany() handles batches", async () => {
    const texts = [
      "First test sentence.",
      "Second test sentence.",
      "Third test sentence.",
    ];

    const embeddings = await embedMany(texts);

    expect(Array.isArray(embeddings)).toBe(true);
    expect(embeddings.length).toBe(texts.length);

    for (const embedding of embeddings) {
      expect(embedding.length).toBe(EMBEDDING_DIM);
      expect(embedding.every((n) => typeof n === "number")).toBe(true);
      expect(embedding.every((n) => Number.isFinite(n))).toBe(true);
    }
  }, 60_000);

  test("embedMany() with empty array returns empty array", async () => {
    const embeddings = await embedMany([]);
    expect(embeddings).toEqual([]);
  });

  test("similar texts have similar embeddings", async () => {
    const text1 = "The quick brown fox jumps over the lazy dog.";
    const text2 = "A fast brown fox leaps over a sleepy dog.";
    const text3 = "Python is a programming language.";

    const [emb1, emb2, emb3] = await embedMany([text1, text2, text3]);

    // Compute cosine similarity
    const cosineSim = (a: number[], b: number[]) => {
      const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
      const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
      const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
      return dotProduct / (magA * magB);
    };

    const sim12 = cosineSim(emb1, emb2); // Similar sentences
    const sim13 = cosineSim(emb1, emb3); // Different topics

    // Similar sentences should have higher similarity
    expect(sim12).toBeGreaterThan(sim13);
    expect(sim12).toBeGreaterThan(0.7); // High similarity for paraphrases
  }, 60_000);
});

