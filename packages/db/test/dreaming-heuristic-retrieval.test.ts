import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { sql } from "drizzle-orm";

const TEST_RESOURCE = "test-dreaming-resource";
const SHOULD_RUN = Boolean(process.env.RUN_DB_TESTS);
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

let graphRepo: typeof import("@alfred/db").graphRepo;
let db: typeof import("@alfred/db").db;
let findHeuristics: typeof import("@alfred/db/repo/codex-learning").findHeuristics;
let buildCodexLearningContext: typeof import("@alfred/db/repo/codex-learning").buildCodexLearningContext;

async function resetGraph() {
  if (!db) {
    return;
  }
  if (typeof db.execute !== "function") {
    return;
  }
  await db.execute(
    sql`TRUNCATE memory_edges, memory_nodes RESTART IDENTITY CASCADE`
  );
}

describeFn("Dreaming Heuristic Retrieval", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "Dreaming heuristic tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const dbMod = await import("@alfred/db");
    graphRepo = dbMod.graphRepo;
    db = dbMod.db;

    const codexLearning = await import("@alfred/db/repo/codex-learning");
    findHeuristics = codexLearning.findHeuristics;
    buildCodexLearningContext = codexLearning.buildCodexLearningContext;
  });

  beforeEach(async () => {
    await resetGraph();
  });

  it("findHeuristics retrieves heuristic nodes created by dreaming", async () => {
    // Create heuristic nodes (simulating what dreaming creates)
    const nodes = await graphRepo.upsertNodes([
      {
        resource: "system",
        hash: "heuristic-1",
        kind: "heuristic",
        label: "Heuristic: Avoid module import errors",
        properties: {
          rule: "Always check package.json dependencies before importing modules",
          trigger: "Module not found",
          count: 3,
          confidence: 0.8,
          source: "dreamer",
        },
      },
      {
        resource: "system",
        hash: "heuristic-2",
        kind: "heuristic",
        label: "Heuristic: Avoid permission errors",
        properties: {
          rule: "Use user-scoped directories instead of system paths",
          trigger: "Permission denied",
          count: 2,
          confidence: 0.8,
          source: "dreamer",
        },
      },
    ]);

    expect(nodes.size).toBe(2);

    // Query for heuristics related to "module import"
    const heuristics = await findHeuristics("module import error", 3);

    expect(heuristics.length).toBeGreaterThan(0);
    expect(heuristics[0]?.rule).toBeDefined();
    expect(heuristics[0]?.confidence).toBeGreaterThan(0);
  });

  it("buildCodexLearningContext includes heuristics in prompt", async () => {
    // Create heuristic nodes
    await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "heuristic-test",
        kind: "heuristic",
        label: "Heuristic: Test rule",
        properties: {
          rule: "Test heuristic rule for verification",
          trigger: "test error",
          count: 1,
          confidence: 0.8,
          source: "dreamer",
        },
      },
    ]);

    // Build learning context
    const context = await buildCodexLearningContext(
      TEST_RESOURCE,
      "test requirement",
      2000
    );

    expect(context).not.toBeNull();
    expect(context).toContain("Intuition");
    expect(context).toContain("Heuristics");
    expect(context).toContain("Test heuristic rule");
  });

  it("buildCodexLearningContext returns null when no heuristics found", async () => {
    // No nodes created

    const context = await buildCodexLearningContext(
      TEST_RESOURCE,
      "unrelated requirement",
      2000
    );

    expect(context).toBeNull();
  });
});
