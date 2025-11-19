/**
 * Smoke Test for Embedding Service
 * Quick sanity check that the embedding service is functional
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { embed, EMBEDDING_DIM, shutdown } from "../src/index";

describe("Embedding Service - Smoke Test", () => {
  afterAll(async () => {
    await shutdown();
  });

  test("service initializes and returns valid embeddings", async () => {
    console.log("[smoke-test] Starting embedding service...");
    
    const testText = "Hello, world!";
    const embedding = await embed(testText);

    // Verify basic properties
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(EMBEDDING_DIM);
    expect(embedding.length).toBe(1024); // MRL truncation
    expect(embedding.every((n) => typeof n === "number")).toBe(true);
    expect(embedding.every((n) => Number.isFinite(n))).toBe(true);

    console.log("[smoke-test] ✓ Service operational");
    console.log(`[smoke-test] ✓ Generated ${EMBEDDING_DIM}-dimensional embedding (MRL truncated)`);
  }, 90_000); // 90s timeout for first run (downloads model if needed)

  test("embeddings are normalized (unit vectors)", async () => {
    const embedding = await embed("Test normalization");

    // Calculate L2 norm (should be ~1.0 for normalized vectors)
    const norm = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    // Allow small floating point error
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);

    console.log(`[smoke-test] ✓ Vector normalized (L2 norm: ${norm.toFixed(4)})`);
  }, 60_000);

  test("service handles errors gracefully", async () => {
    // This should still work - empty string handling is in the application layer
    const embedding = await embed("");
    expect(Array.isArray(embedding)).toBe(true);
  }, 60_000);
});

