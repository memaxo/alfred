/**
 * Integration tests for the rerank package.
 *
 * These tests verify the TypeScript client and integration with the Python server.
 * Server tests require QWEN3VL_RERANK_URL to be set (skipped if not available).
 */

import { beforeAll, describe, expect, it } from "bun:test";
import {
  checkHealth,
  isQwen3VLAvailable,
  qwen3vlRerank,
  rerank,
} from "../src/index.js";

describe("TypeScript Client", () => {
  describe("checkHealth", () => {
    it("returns error when server is not running", async () => {
      // Point to a non-existent server
      process.env.QWEN3VL_RERANK_URL = "http://localhost:19999";

      const result = await checkHealth();

      expect(result.status).toBe("error");
      expect(result.error).toBeDefined();

      process.env.QWEN3VL_RERANK_URL = undefined;
    });
  });

  describe("isQwen3VLAvailable", () => {
    it("returns false when server is not running", async () => {
      process.env.QWEN3VL_RERANK_URL = "http://localhost:19999";

      const available = await isQwen3VLAvailable();

      expect(available).toBe(false);

      process.env.QWEN3VL_RERANK_URL = undefined;
    });
  });

  describe("qwen3vlRerank", () => {
    it("returns empty array with fail-open when server unavailable", async () => {
      process.env.QWEN3VL_RERANK_URL = "http://localhost:19999";

      const results = await qwen3vlRerank({
        query: { text: "test query" },
        documents: [
          { id: "1", text: "document one" },
          { id: "2", text: "document two" },
        ],
      });

      // Fail-open: returns empty array instead of throwing
      expect(results).toEqual([]);

      process.env.QWEN3VL_RERANK_URL = undefined;
    });
  });
});

describe("Unified rerank API", () => {
  it("handles no backend configured gracefully", async () => {
    // Clear all backend config
    process.env.COHERE_API_KEY = undefined;
    process.env.QWEN3VL_RERANK_URL = undefined;
    process.env.RERANK_BACKEND = undefined;

    const results = await rerank({
      query: "test query",
      documents: [
        { id: "1", text: "document one" },
        { id: "2", text: "document two" },
      ],
    });

    // Should return empty (fail-open)
    expect(results).toEqual([]);
  });

  it("respects topN parameter", async () => {
    // Without a backend, we get empty results
    // But we verify the parameter is accepted
    const results = await rerank({
      query: "test",
      documents: [
        { id: "1", text: "a" },
        { id: "2", text: "b" },
        { id: "3", text: "c" },
      ],
      topN: 2,
    });

    expect(results.length).toBeLessThanOrEqual(2);
  });
});

// Conditional tests that require a running server
const serverUrl = process.env.QWEN3VL_RERANK_URL;

describe.skipIf(!serverUrl)("Live Server Tests", () => {
  beforeAll(async () => {
    // Wait for server to be ready
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const health = await checkHealth();
      if (health.status === "ok") {
        console.log(`Server ready: ${health.model} on ${health.device}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Server not ready after 10 seconds");
  });

  it("health check returns ok", async () => {
    const health = await checkHealth();
    expect(health.status).toBe("ok");
    expect(health.model).toBeDefined();
    expect(health.device).toBeDefined();
  });

  it("reranks text-only documents", async () => {
    const results = await qwen3vlRerank({
      query: { text: "machine learning algorithms" },
      documents: [
        {
          id: "1",
          text: "Neural networks are a type of machine learning model.",
        },
        { id: "2", text: "The weather today is sunny and warm." },
        {
          id: "3",
          text: "Deep learning uses multiple layers of neural networks.",
        },
      ],
      topN: 2,
    });

    expect(results.length).toBe(2);
    // The ML-related docs should score higher
    const ids = results.map((r) => r.id);
    expect(ids).toContain("1");
    expect(ids).toContain("3");
  });

  it("handles documents with images", async () => {
    const results = await qwen3vlRerank({
      query: { text: "user interface design" },
      documents: [
        {
          id: "1",
          text: "A beautiful UI mockup",
          // Use a local test image if available
          imageUrl:
            process.env.TEST_IMAGE_URL || "https://via.placeholder.com/150",
        },
        { id: "2", text: "Backend server configuration" },
      ],
      topN: 2,
    });

    expect(results.length).toBeLessThanOrEqual(2);
    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("score");
  });

  it("respects batch processing for text-only", async () => {
    // Create many text-only documents to trigger batching
    const documents = Array.from({ length: 20 }, (_, i) => ({
      id: `doc-${i}`,
      text: `Document number ${i} about various topics like AI, ML, and data science.`,
    }));

    const start = Date.now();
    const results = await qwen3vlRerank({
      query: { text: "artificial intelligence" },
      documents,
      topN: 5,
    });
    const elapsed = Date.now() - start;

    expect(results.length).toBe(5);
    console.log(`Reranked 20 documents in ${elapsed}ms`);
  });
});
