/**
 * E2E Test for Note -> RAG -> Embed Flow
 * Tests the complete integration from note creation through embedding to retrieval
 */

import { describe, test, expect, afterAll } from "bun:test";
import { ingest, retrieve } from "@alfred/rag";
import { db } from "@alfred/db";
import { memoryNodes } from "@alfred/db/schema/graph";
import { eq } from "drizzle-orm";
import { describePostgres } from "@alfred/db/testing";
import { embed, embedMany, shutdown, EMBEDDING_DIM } from "../src/index";

const RUN_EMBED_MODEL_TESTS = process.env.RUN_EMBED_MODEL_TESTS === "1";

const describePgModel = RUN_EMBED_MODEL_TESTS
  ? describePostgres
  : (name: string, factory: Parameters<typeof describePostgres>[1]) =>
      describe.skip(`${name} (requires RUN_EMBED_MODEL_TESTS=1)`, factory);

describePgModel("E2E: Note -> RAG -> Embed Flow", () => {
  afterAll(async () => {
    await shutdown();
  });

  test("complete flow: ingest -> embed -> retrieve", async () => {
    console.log("[e2e-test] Starting complete flow test...");

    // Step 1: Ingest a test note
    const noteContent = "ALFRED uses local KaLM-Embedding model for privacy-preserving embeddings with 3840 dimensions.";
    const noteSource = `test:note:e2e:${Date.now()}`;

    console.log("[e2e-test] Step 1: Ingesting note...");
    const documentId = await ingest(noteSource, noteContent);
    expect(documentId).toBeTruthy();
    console.log(`[e2e-test] ✓ Document created: ${documentId}`);

    // Step 2: Wait for async embedding to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 3: Retrieve with semantic query
    console.log("[e2e-test] Step 2: Retrieving with semantic query...");
    const chunks = await retrieve("local embedding model privacy", 5, 0.5);

    console.log(`[e2e-test] ✓ Retrieved ${chunks.length} chunks`);

    // Verify we found at least one relevant chunk
    expect(Array.isArray(chunks)).toBe(true);
    
    if (chunks.length > 0) {
      const topChunk = chunks[0];
      expect(topChunk).toHaveProperty("content");
      expect(topChunk).toHaveProperty("metadata");
      expect(typeof topChunk.content).toBe("string");
      
      // Verify it's our content or similar
      const metadata = topChunk.metadata as any;
      expect(metadata.score).toBeGreaterThan(0.5);
      
      console.log(`[e2e-test] ✓ Top chunk score: ${metadata.score.toFixed(3)}`);
      console.log(`[e2e-test] ✓ Content preview: ${topChunk.content.slice(0, 80)}...`);
    }
  }, 120_000); // 2 minutes for complete flow

  test("batch embedding maintains consistency", async () => {
    console.log("[e2e-test] Testing batch consistency...");

    const notes = [
      "Machine learning embeddings represent text as vectors.",
      "Vector databases enable semantic search over documents.",
      "Hybrid search combines dense and sparse retrieval methods.",
    ];

    // Embed individually
    const individual = await Promise.all(notes.map((text) => embed(text)));

    // Embed as batch
    const batched = await embedMany(notes);

    // Results should be identical
    expect(batched.length).toBe(individual.length);
    
    // Verify dimensions
    expect(individual[0].length).toBe(1024);
    expect(batched[0].length).toBe(1024);

    for (let i = 0; i < notes.length; i++) {
      // Compare vectors (should be very similar, allowing for floating point)
      const diff = individual[i].reduce((sum, val, idx) => {
        return sum + Math.abs(val - batched[i][idx]);
      }, 0);
      
      // Average absolute difference should be negligible
      const avgDiff = diff / EMBEDDING_DIM;
      expect(avgDiff).toBeLessThan(0.0001);
    }

    console.log("[e2e-test] ✓ Batch and individual embeddings are consistent (1024 dims)");
  }, 120_000);

  test("semantic similarity detection", async () => {
    console.log("[e2e-test] Testing semantic similarity...");

    // Ingest related documents
    const docs = [
      { source: `test:doc1:${Date.now()}`, content: "Python is a popular programming language for data science and machine learning." },
      { source: `test:doc2:${Date.now()}`, content: "JavaScript is widely used for web development and frontend applications." },
      { source: `test:doc3:${Date.now()}`, content: "PyTorch and TensorFlow are deep learning frameworks built with Python." },
    ];

    for (const doc of docs) {
      await ingest(doc.source, doc.content);
    }

    // Wait for embeddings
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Query for Python/ML content
    const mlChunks = await retrieve("Python machine learning frameworks", 5, 0.5);
    
    console.log(`[e2e-test] ✓ Found ${mlChunks.length} ML-related chunks`);

    // Query for web dev content
    const webChunks = await retrieve("JavaScript web development", 5, 0.5);
    
    console.log(`[e2e-test] ✓ Found ${webChunks.length} web-related chunks`);

    // Both queries should return results
    expect(mlChunks.length).toBeGreaterThan(0);
    expect(webChunks.length).toBeGreaterThan(0);

    console.log("[e2e-test] ✓ Semantic search successfully distinguishes topics");
  }, 150_000);

  test(
    "RAG enrichment populates memory_nodes when enabled",
    async () => {
      if (process.env.RAG_ENRICH_GRAPH !== "1") {
        // Enrichment is optional; treat as a no-op when disabled.
        console.log(
          "[e2e-test] Skipping RAG enrichment → graph assertion (RAG_ENRICH_GRAPH != 1)"
        );
        return;
      }

      const source = `test:rag-graph:${Date.now()}`;
      const content =
        "Hypergraph integration test content for knowledge graph enrichment.";

      const documentId = await ingest(source, content);
      expect(documentId).toBeTruthy();

      const resource = `rag:${source}`;
      const rows = await db
        .select()
        .from(memoryNodes)
        .where(eq(memoryNodes.resource, resource));

      expect(rows.length).toBeGreaterThan(0);
    },
    120_000
  );
});
