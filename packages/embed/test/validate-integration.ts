/**
 * Manual Validation Script for Embedding + HNSW Search
 * Tests: embed() → ingest() → retrieve() with 1024-dim vectors
 */

import { ingest, retrieve } from "@alfred/rag";
import { embed, embedMany } from "../src/index";

async function main() {
  const testEmbedding = await embed("Hello, world!");

  if (testEmbedding.length !== 1024) {
    throw new Error(
      `Dimension mismatch! Expected 1024, got ${testEmbedding.length}`
    );
  }

  // Step 2: Test normalization
  const norm = Math.sqrt(
    testEmbedding.reduce((sum, val) => sum + val * val, 0)
  );

  if (Math.abs(norm - 1.0) > 0.01) {
    throw new Error(`Normalization failed! Norm: ${norm}`);
  }
  const testNote =
    "ALFRED uses KaLM-Embedding with 1024 dimensions for local embeddings.";
  const testSource = `test:validation:${Date.now()}`;

  const _documentId = await ingest(testSource, testNote);

  // Wait for async embedding
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const chunks = await retrieve("local embeddings 1024 dimensions", 5, 0.4);

  if (chunks.length > 0) {
    const topChunk = chunks[0];
    // biome-ignore lint/suspicious/noExplicitAny: Validation script inspection
    const _metadata = topChunk.metadata as any;
  }
  const texts = [
    "Python is a programming language",
    "JavaScript is used for web development",
    "Python is great for data science",
  ];

  const embeddings = await embedMany(texts);

  const cosineSim = (a: number[], b: number[]) => {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    return dotProduct; // Already normalized, so dot product = cosine similarity
  };

  const sim01 = cosineSim(embeddings[0], embeddings[1]);
  const sim02 = cosineSim(embeddings[0], embeddings[2]);

  if (sim02 <= sim01) {
    throw new Error(
      "Similarity check failed - model not distinguishing topics properly"
    );
  }

  process.exit(0);
}

main().catch((_error) => {
  process.exit(1);
});
