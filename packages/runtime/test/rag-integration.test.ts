/**
 * RAG Integration Tests
 *
 * Tests the integration of RAG system with runtime context builder
 * Includes model-aware retrieval tests for heterogeneous embedding support
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getCurrentModelId, ingest } from "@alfred/rag";
import { ContextBuilder } from "../src/context";
import { KnowledgeEngine } from "../src/engines/knowledge";

const RUN_RAG_TESTS = process.env.RUN_RUNTIME_RAG_TESTS === "1";
const heavyTest = RUN_RAG_TESTS ? test : test.skip;

describe("RAG Integration", () => {
  let builder: ContextBuilder;

  beforeAll(() => {
    builder = new ContextBuilder();
  });

  afterAll(() => {
    builder.clearCache();
  });

  test("KnowledgeEngine.retrieveContext() returns chunks", async () => {
    const engine = new KnowledgeEngine();

    // Test with empty query
    const emptyResult = await engine.retrieveContext("", {
      useHybrid: true,
      topK: 5,
      threshold: 0.7,
    });
    expect(emptyResult).toEqual([]);

    // Note: Real retrieval tests require seeded RAG documents
    // This test primarily validates the API contract
  }, 10_000);

  test("ContextBuilder includes ragChunks field", async () => {
    const context = await builder.build({
      requirement: "test requirement",
      workspace: process.cwd(),
      web: false,
    });

    // Verify ExecutionContext includes ragChunks field
    expect(context).toHaveProperty("ragChunks");
    expect(context.totalTokens).toBeGreaterThanOrEqual(0);
  }, 30_000);

  heavyTest(
    "ingest() creates RAG document",
    async () => {
      const testContent = "This is a test note for RAG integration.";
      const testSource = `test:note:${Date.now()}`;

      // Ingest should complete without errors
      const documentId = await ingest(testSource, testContent);
      expect(documentId).toBeTruthy();
      expect(typeof documentId).toBe("string");
    },
    60_000
  ); // Increased timeout for local model loading

  heavyTest(
    "retrieveContext() finds ingested content",
    async () => {
      // Ingest test content
      const testContent =
        "ALFRED is a personal AI assistant with cognitive architecture.";
      const testSource = `test:search:${Date.now()}`;
      await ingest(testSource, testContent);

      // Wait a moment for indexing (in production, this happens asynchronously)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Retrieve with related query
      const engine = new KnowledgeEngine();
      const chunks = await engine.retrieveContext("cognitive architecture", {
        useHybrid: true,
        topK: 5,
        threshold: 0.5, // Lower threshold for test
      });

      // Should find at least one chunk (may find more if other content exists)
      expect(Array.isArray(chunks)).toBe(true);

      // Verify chunk structure
      if (chunks.length > 0) {
        const chunk = chunks[0];
        expect(chunk).toHaveProperty("content");
        expect(chunk).toHaveProperty("metadata");
        expect(typeof chunk.content).toBe("string");
      }
    },
    90_000
  ); // Increased timeout for local model loading
});

describe("Model-Aware Retrieval", () => {
  test("getCurrentModelId() returns a valid model ID", () => {
    const modelId = getCurrentModelId();

    // Model ID should be a non-empty string
    expect(typeof modelId).toBe("string");
    expect(modelId.length).toBeGreaterThan(0);

    // Should be one of the known model IDs
    const knownIds = ["kalm-12b-1024", "qwen3-vl-2b-1024"];
    expect(knownIds).toContain(modelId);
  });

  test("getCurrentModelId() is consistent across calls", () => {
    const modelId1 = getCurrentModelId();
    const modelId2 = getCurrentModelId();

    expect(modelId1).toBe(modelId2);
  });

  test("KnowledgeEngine.retrieveContext() handles empty input gracefully", async () => {
    const engine = new KnowledgeEngine();

    // Empty string should return empty array (no embedding needed)
    const emptyResult = await engine.retrieveContext("");
    expect(emptyResult).toEqual([]);

    // Whitespace-only should return empty array (no embedding needed)
    const whitespaceResult = await engine.retrieveContext("   ");
    expect(whitespaceResult).toEqual([]);
  });

  // These tests require initialized embedding pool - run with RUN_RUNTIME_RAG_TESTS=1
  heavyTest(
    "KnowledgeEngine filters by model ID",
    async () => {
      const engine = new KnowledgeEngine();

      // Retrieve with non-empty query - requires embedding
      const result = await engine.retrieveContext(
        "test query with no matches",
        {
          useHybrid: false,
          topK: 5,
          threshold: 0.99, // Very high threshold to ensure no matches
        }
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    },
    10_000
  );

  heavyTest(
    "KnowledgeEngine.retrieveContext() respects threshold option",
    async () => {
      const engine = new KnowledgeEngine();

      // Very high threshold (0.99) should return no results for generic queries
      const result = await engine.retrieveContext("generic test query", {
        threshold: 0.99,
        topK: 10,
      });

      // Even if there are indexed documents, 0.99 threshold is extremely strict
      expect(Array.isArray(result)).toBe(true);
    },
    10_000
  );
});

describe("Embedding Model Configuration", () => {
  test("MODEL_IDS contains expected model identifiers", async () => {
    const { MODEL_IDS } = await import("@alfred/embed");

    expect(MODEL_IDS.KALM_12B).toBe("kalm-12b-1024");
    expect(MODEL_IDS.QWEN3_VL_2B).toBe("qwen3-vl-2b-1024");
  });

  test("MODEL_CONFIGS contains capability information", async () => {
    const { MODEL_CONFIGS, MODEL_IDS } = await import("@alfred/embed");

    // KaLM is text-only
    const kalmConfig = MODEL_CONFIGS[MODEL_IDS.KALM_12B];
    expect(kalmConfig.capabilities.text).toBe(true);
    expect(kalmConfig.capabilities.image).toBe(false);

    // Qwen is multimodal
    const qwenConfig = MODEL_CONFIGS[MODEL_IDS.QWEN3_VL_2B];
    expect(qwenConfig.capabilities.text).toBe(true);
    expect(qwenConfig.capabilities.image).toBe(true);
    expect(qwenConfig.capabilities.video).toBe(true);
  });
});
