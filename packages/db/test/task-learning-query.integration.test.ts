/**
 * Integration test: write → query loop for task_learning nodes.
 * Proves that ephemeral learnings written by ReflectionObserver
 * are queryable via findSimilarWithFallback().
 */
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_RESOURCE = "task-learning-integ";

let graphRepo: typeof import("@alfred/db").graphRepo;
let db: typeof import("@alfred/db").db;
let codexLearningFns: typeof import("@alfred/db/repo/codex-learning");

async function resetGraph() {
  if (!db) {
    return;
  }
  await db.execute(
    sql`TRUNCATE memory_edges, memory_nodes RESTART IDENTITY CASCADE`
  );
}

describeFn("task_learning query loop (integration)", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "task_learning query tests need Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    ({ graphRepo } = mod);
    ({ db } = mod);
    codexLearningFns = await import("@alfred/db/repo/codex-learning");
  });

  beforeEach(async () => {
    await resetGraph();
  });

  it("writes a task_learning node and retrieves it via findSimilarCodexExecutions", async () => {
    // Write a task_learning node (like ReflectionObserver does via persistLearning callback)
    await graphRepo.createNode(
      `run:${TEST_RESOURCE}`,
      "hash-task-learn-1",
      "task_learning",
      "Always run tests before committing to avoid regressions",
      {
        runId: "run-001",
        taskId: "task-001",
        outcome: "success",
        source: "reflect",
        ts: Date.now(),
      }
    );

    // Mark as sanitized so it's queryable
    await db.execute(
      sql`UPDATE memory_nodes SET sanitized = true WHERE hash = 'hash-task-learn-1'`
    );

    // Query via keyword search (findSimilarCodexExecutions now includes task_learning)
    const results = await codexLearningFns.findSimilarCodexExecutions(
      `run:${TEST_RESOURCE}`,
      "run tests before committing regressions",
      5
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.at(0)?.similarity).toBeGreaterThan(0);
  });

  it("includes task_learning in findSimilarWithFallback keyword path", async () => {
    await graphRepo.createNode(
      `run:${TEST_RESOURCE}`,
      "hash-task-learn-2",
      "task_learning",
      "Pipeline timeout should be increased for large codebases",
      {
        runId: "run-002",
        taskId: "task-002",
        outcome: "failure",
        source: "failure",
        ts: Date.now(),
      }
    );

    await db.execute(
      sql`UPDATE memory_nodes SET sanitized = true WHERE hash = 'hash-task-learn-2'`
    );

    const results = await codexLearningFns.findSimilarWithFallback(
      `run:${TEST_RESOURCE}`,
      "pipeline timeout increased large codebases",
      null,
      5
    );

    expect(results.length).toBeGreaterThan(0);
  });

  it("does not return unsanitized task_learning nodes", async () => {
    await graphRepo.createNode(
      `run:${TEST_RESOURCE}`,
      "hash-unsanitized",
      "task_learning",
      "This node is not sanitized and should not appear",
      {
        runId: "run-003",
        taskId: "task-003",
        outcome: "success",
        source: "reflect",
        ts: Date.now(),
      }
    );

    // Note: not marking as sanitized

    const results = await codexLearningFns.findSimilarCodexExecutions(
      `run:${TEST_RESOURCE}`,
      "not sanitized should not appear",
      5
    );

    expect(results.length).toBe(0);
  });
});
