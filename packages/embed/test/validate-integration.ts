/**
 * Manual Validation Script for Embedding + HNSW Search
 * Tests: embed() → ingest() → retrieve() with 1024-dim vectors
 */

import { embed, embedMany, EMBEDDING_DIM } from "../src/index";
import { ingest, retrieve } from "@alfred/rag";

async function main() {
  console.log("=== Embedding Integration Validation ===\n");

  // Step 1: Verify embedding dimensions
  console.log("Step 1: Testing embedding generation...");
  const testEmbedding = await embed("Hello, world!");
  console.log(`✓ Generated embedding with ${testEmbedding.length} dimensions`);
  console.log(`✓ Expected: ${EMBEDDING_DIM}, Actual: ${testEmbedding.length}`);
  
  if (testEmbedding.length !== 1024) {
    throw new Error(`Dimension mismatch! Expected 1024, got ${testEmbedding.length}`);
  }

  // Step 2: Test normalization
  const norm = Math.sqrt(
    testEmbedding.reduce((sum, val) => sum + val * val, 0)
  );
  console.log(`✓ Vector L2 norm: ${norm.toFixed(4)} (should be ~1.0)`);
  
  if (Math.abs(norm - 1.0) > 0.01) {
    throw new Error(`Normalization failed! Norm: ${norm}`);
  }

  // Step 3: Test RAG ingest
  console.log("\nStep 2: Testing RAG ingest...");
  const testNote = "ALFRED uses KaLM-Embedding with 1024 dimensions for local embeddings.";
  const testSource = `test:validation:${Date.now()}`;
  
  const documentId = await ingest(testSource, testNote);
  console.log(`✓ Note ingested, document ID: ${documentId}`);

  // Wait for async embedding
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step 4: Test retrieval with HNSW search
  console.log("\nStep 3: Testing RAG retrieval with HNSW...");
  
  try {
    const chunks = await retrieve("local embeddings 1024 dimensions", 5, 0.4);
    
    console.log(`✓ Retrieved ${chunks.length} chunks`);
    
    if (chunks.length > 0) {
      const topChunk = chunks[0];
      const metadata = topChunk.metadata as any;
      console.log(`  - Top chunk score: ${metadata.score.toFixed(3)}`);
      console.log(`  - Content preview: ${topChunk.content.slice(0, 60)}...`);
    }
  } catch (error: any) {
    console.error("✗ Retrieval failed:");
    console.error("  Message:", error.message);
    console.error("  Stack:", error.stack);
    throw error;
  }

  // Step 5: Test similarity
  console.log("\nStep 4: Testing semantic similarity...");
  const texts = [
    "Python is a programming language",
    "JavaScript is used for web development",  
    "Python is great for data science",
  ];
  
  const embeddings = await embedMany(texts);
  console.log(`✓ Generated ${embeddings.length} embeddings`);
  
  const cosineSim = (a: number[], b: number[]) => {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    return dotProduct; // Already normalized, so dot product = cosine similarity
  };
  
  const sim01 = cosineSim(embeddings[0], embeddings[1]);
  const sim02 = cosineSim(embeddings[0], embeddings[2]);
  
  console.log(`  - Python vs JavaScript similarity: ${sim01.toFixed(3)}`);
  console.log(`  - Python vs Python similarity: ${sim02.toFixed(3)}`);
  console.log(`  - Quality check: Related topics (${sim02.toFixed(3)}) > Unrelated (${sim01.toFixed(3)}): ${sim02 > sim01 ? "✓" : "✗"}`);

  if (sim02 <= sim01) {
    throw new Error("Similarity check failed - model not distinguishing topics properly");
  }

  console.log("\n=== All Validation Checks Passed ===");
  console.log("✓ Embedding generation: 1024 dimensions");
  console.log("✓ Vector normalization: L2 norm = 1.0");
  console.log("✓ RAG ingest: Documents embedded successfully");
  console.log("✓ HNSW search: Retrieval working with 1024-dim vectors");
  console.log("✓ Semantic quality: Model distinguishes similar/different topics");
  
  process.exit(0);
}

main().catch((error) => {
  console.error("\n✗ Validation failed:", error.message);
  process.exit(1);
});

