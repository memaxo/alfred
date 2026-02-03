import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  calculateStorageMetrics,
  getCasMetrics,
  recordCasHit,
  recordCasMiss,
  resetCasMetricsForTests,
} from "../src/services/agentfs-metrics";

describe("agentfs metrics", () => {
  const rootAbs = path.resolve(
    process.cwd(),
    ".agent",
    "test-workspaces",
    "agentfs-metrics"
  );

  afterAll(async () => {
    await rm(rootAbs, { force: true, recursive: true });
  });

  beforeEach(async () => {
    await rm(rootAbs, { force: true, recursive: true });
  });

  it("attributes CAS bytes and archiveCount per project", async () => {
    const projectA = "11111111-1111-4111-8111-111111111111";
    const projectB = "22222222-2222-4222-8222-222222222222";

    const runA = path.join(rootAbs, "run-a");
    await mkdir(runA, { recursive: true });
    await writeFile(path.join(runA, ".project"), `${projectA}\n`, "utf8");
    await writeFile(path.join(runA, "agentfs.db"), "db-a", "utf8");

    const runB = path.join(rootAbs, "run-b");
    await mkdir(runB, { recursive: true });
    await writeFile(path.join(runB, ".project"), projectB, "utf8");
    await writeFile(path.join(runB, "agentfs.db"), "db-b", "utf8");

    const casDir = path.join(rootAbs, "cas");
    await mkdir(casDir, { recursive: true });

    const shaA = "a".repeat(64);
    const shaB = "b".repeat(64);
    const shaNone = "c".repeat(64);

    await writeFile(path.join(casDir, `${shaA}.tar.gz`), "aaaaaaaaaa", "utf8"); // 10 bytes
    await writeFile(
      path.join(casDir, `${shaA}.json`),
      JSON.stringify(
        {
          sha: shaA,
          runId: "run-a",
          projectId: projectA,
          createdAt: new Date().toISOString(),
          sizeBytes: 10,
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(path.join(casDir, `${shaA}.keep`), "", "utf8");

    await writeFile(
      path.join(casDir, `${shaB}.tar.gz`),
      "bbbbbbbbbbbbbbbbbbbb",
      "utf8"
    ); // 20 bytes
    await writeFile(
      path.join(casDir, `${shaB}.json`),
      JSON.stringify(
        {
          sha: shaB,
          runId: "run-b",
          projectId: projectB,
          createdAt: new Date().toISOString(),
          sizeBytes: 20,
        },
        null,
        2
      ),
      "utf8"
    );

    await writeFile(path.join(casDir, `${shaNone}.tar.gz`), "ccccc", "utf8"); // 5 bytes
    await writeFile(
      path.join(casDir, `${shaNone}.json`),
      JSON.stringify(
        {
          sha: shaNone,
          runId: "run-x",
          projectId: null,
          createdAt: new Date().toISOString(),
          sizeBytes: 5,
        },
        null,
        2
      ),
      "utf8"
    );

    const quarantineDir = path.join(rootAbs, "quarantine");
    await mkdir(quarantineDir, { recursive: true });
    await writeFile(path.join(quarantineDir, "q.txt"), "qqqq", "utf8");

    const globalMetrics = await calculateStorageMetrics({ rootAbs });
    expect(globalMetrics.cas.archiveCount).toBe(3);
    expect(globalMetrics.cas.totalBytes).toBe(35);
    expect(globalMetrics.cas.pinnedCount).toBe(1);
    expect(globalMetrics.cas.pinnedBytes).toBe(10);
    expect(globalMetrics.total.quarantineBytes).toBe(4);

    const byA = globalMetrics.byProject.find((p) => p.projectId === projectA);
    expect(byA).toBeDefined();
    expect(byA?.archiveCount).toBe(1);
    expect(byA?.casBytes).toBe(10);
    expect(byA?.runCount).toBe(1);

    const byB = globalMetrics.byProject.find((p) => p.projectId === projectB);
    expect(byB).toBeDefined();
    expect(byB?.archiveCount).toBe(1);
    expect(byB?.casBytes).toBe(20);
    expect(byB?.runCount).toBe(1);

    const projectMetrics = await calculateStorageMetrics({
      rootAbs,
      projectId: projectA,
    });
    expect(projectMetrics.runs.length).toBe(1);
    expect(projectMetrics.runs[0]?.runId).toBe("run-a");
    expect(projectMetrics.cas.archiveCount).toBe(1);
    expect(projectMetrics.cas.totalBytes).toBe(10);
    expect(projectMetrics.cas.pinnedCount).toBe(1);
    expect(projectMetrics.cas.pinnedBytes).toBe(10);
    expect(projectMetrics.total.quarantineBytes).toBe(0);

    expect(projectMetrics.byProject).toEqual([
      expect.objectContaining({
        projectId: projectA,
        archiveCount: 1,
        casBytes: 10,
        runCount: 1,
      }),
    ]);
    expect(projectMetrics.total.runsBytes).toBe(
      projectMetrics.byProject[0]?.runsBytes
    );
  });

  it("tracks CAS hit/miss ratio", async () => {
    resetCasMetricsForTests();
    recordCasHit();
    recordCasHit();
    recordCasMiss();
    const metrics = await getCasMetrics();
    expect(metrics.hits).toBe(2);
    expect(metrics.misses).toBe(1);
    expect(metrics.ratio).toBeCloseTo(2 / 3);
  });
});
