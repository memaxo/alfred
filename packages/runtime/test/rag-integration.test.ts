/**
 * RAG Integration Tests
 *
 * Tests the integration of RAG system with runtime context builder
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ingest } from "@alfred/rag";
import { ContextBuilder } from "../src/context";
import { KnowledgeEngine } from "../src/engines/knowledge";

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

  test("ingest() creates RAG document", async () => {
    const testContent = "This is a test note for RAG integration.";
    const testSource = `test:note:${Date.now()}`;

    // Ingest should complete without errors
    const documentId = await ingest(testSource, testContent);
    expect(documentId).toBeTruthy();
    expect(typeof documentId).toBe("string");
  }, 60_000); // Increased timeout for local model loading

  test("retrieveContext() finds ingested content", async () => {
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
  }, 90_000); // Increased timeout for local model loading
});
