import { describe, test, expect } from "bun:test";

import { findRelevantFiles, rebuildIndex, clearIndex } from "../src/index.js";

const ALFRED_ROOT = process.cwd().replace(/\/packages\/codeprint$/, "");

describe("performance", () => {
  test("index build < 10s for ALFRED monorepo", async () => {
    clearIndex(ALFRED_ROOT);

    const start = performance.now();
    const count = await rebuildIndex(ALFRED_ROOT);
    const elapsed = performance.now() - start;

    console.log(`Indexed ${count} files in ${elapsed.toFixed(0)}ms`);
    expect(count).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(10_000);
  });

  test("query < 200ms", async () => {
    const start = performance.now();
    const results = await findRelevantFiles(
      ALFRED_ROOT,
      "rerank workflow api endpoint router",
      15
    );
    const elapsed = performance.now() - start;

    console.log(
      `Found ${results.length} files in ${elapsed.toFixed(0)}ms:`,
      results.slice(0, 5).map((r) => r.path)
    );
    expect(elapsed).toBeLessThan(200);
    expect(results.length).toBeGreaterThan(0);
  });

  test("query finds relevant files for planner task", async () => {
    const results = await findRelevantFiles(
      ALFRED_ROOT,
      "add rate limiting to workflow api",
      10
    );

    const paths = results.map((r) => r.path);
    console.log("Planner query results:", paths);

    // Should find workflow-related files
    const hasWorkflowFile = paths.some(
      (p) => p.includes("workflow") || p.includes("api") || p.includes("router")
    );
    expect(hasWorkflowFile).toBe(true);
  });

  test("repeated queries use cache", async () => {
    // First query (may build index)
    await findRelevantFiles(ALFRED_ROOT, "test query", 5);

    // Second query should be fast (cached)
    const start = performance.now();
    await findRelevantFiles(ALFRED_ROOT, "another test query", 5);
    const elapsed = performance.now() - start;

    console.log(`Cached query: ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(50);
  });
});
