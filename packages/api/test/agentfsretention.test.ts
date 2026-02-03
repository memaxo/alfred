import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  generateRetentionPreview,
  getPolicyViolations,
} from "../src/services/agentfs-retention";

describe("agentfs retention", () => {
  const rootAbs = path.resolve(
    process.cwd(),
    ".agent",
    "test-workspaces",
    "agentfs-retention"
  );

  afterAll(async () => {
    await rm(rootAbs, { force: true, recursive: true });
  });

  beforeEach(async () => {
    await rm(rootAbs, { force: true, recursive: true });
  });

  it("uses scheduler evaluation for age-based run + CAS deletion", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const old = new Date("2025-12-01T00:00:00.000Z");

    const runId = "run-age";
    const runDir = path.join(rootAbs, runId);
    await mkdir(runDir, { recursive: true });
    const dbAbs = path.join(runDir, "agentfs.db");
    await writeFile(dbAbs, "db", "utf8");
    await utimes(dbAbs, old, old);

    const casDir = path.join(rootAbs, "cas");
    await mkdir(casDir, { recursive: true });
    const sha = "a".repeat(64);
    const tarAbs = path.join(casDir, `${sha}.tar.gz`);
    await writeFile(tarAbs, "x".repeat(100), "utf8");
    await writeFile(
      path.join(casDir, `${sha}.json`),
      JSON.stringify(
        {
          sha,
          runId,
          projectId: null,
          createdAt: old.toISOString(),
          sizeBytes: 100,
        },
        null,
        2
      ),
      "utf8"
    );

    const preview = await generateRetentionPreview({
      rootAbs,
      now,
      retentionDays: 1,
      casRetentionDays: 1,
      maxBytes: null,
      casMaxBytes: null,
    });

    expect(preview.runsToDelete.map((r) => r.id)).toEqual([runId]);
    expect(preview.runsToDelete[0]?.reason).toBe("age");
    expect(preview.casToDelete.map((c) => c.id)).toEqual([sha]);
    expect(preview.casToDelete[0]?.reason).toBe("age");
    expect(preview.parameters.casRetentionDays).toBe(1);
    expect(preview.bytesToFree).toBeGreaterThanOrEqual(100);
  });

  it("uses scheduler evaluation for size-cap deletions", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const t1 = new Date("2025-12-31T00:00:00.000Z");
    const t2 = new Date("2025-12-31T12:00:00.000Z");

    const runA = path.join(rootAbs, "run-a");
    await mkdir(runA, { recursive: true });
    const dbA = path.join(runA, "agentfs.db");
    await writeFile(dbA, "a", "utf8");
    await writeFile(path.join(runA, "big.txt"), "x".repeat(100), "utf8");
    await utimes(dbA, t1, t1);

    const runB = path.join(rootAbs, "run-b");
    await mkdir(runB, { recursive: true });
    const dbB = path.join(runB, "agentfs.db");
    await writeFile(dbB, "b", "utf8");
    await writeFile(path.join(runB, "mid.txt"), "y".repeat(50), "utf8");
    await utimes(dbB, t2, t2);

    const preview = await generateRetentionPreview({
      rootAbs,
      now,
      retentionDays: 3650,
      casRetentionDays: 3650,
      maxBytes: 80,
      casMaxBytes: null,
    });

    expect(preview.runsToDelete.length).toBe(1);
    expect(preview.runsToDelete[0]?.id).toBe("run-a");
    expect(preview.runsToDelete[0]?.reason).toBe("size_cap");
  });

  it("reports pinned-age and size-cap violations for runs + CAS", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const old = new Date("2025-11-01T00:00:00.000Z");

    const env = {
      ALFRED_AGENTFS_RETENTION_DAYS: process.env.ALFRED_AGENTFS_RETENTION_DAYS,
      ALFRED_AGENTFS_CAS_RETENTION_DAYS:
        process.env.ALFRED_AGENTFS_CAS_RETENTION_DAYS,
      ALFRED_AGENTFS_MAX_BYTES: process.env.ALFRED_AGENTFS_MAX_BYTES,
      ALFRED_AGENTFS_CAS_MAX_BYTES: process.env.ALFRED_AGENTFS_CAS_MAX_BYTES,
    };

    try {
      process.env.ALFRED_AGENTFS_RETENTION_DAYS = "7";
      process.env.ALFRED_AGENTFS_CAS_RETENTION_DAYS = "7";
      process.env.ALFRED_AGENTFS_MAX_BYTES = "50";
      process.env.ALFRED_AGENTFS_CAS_MAX_BYTES = "50";

      const pinnedRun = path.join(rootAbs, "run-pinned");
      await mkdir(pinnedRun, { recursive: true });
      const pinnedDb = path.join(pinnedRun, "agentfs.db");
      await writeFile(pinnedDb, "db", "utf8");
      await writeFile(path.join(pinnedRun, ".keep"), "pinned", "utf8");
      await utimes(pinnedDb, old, old);

      const runA = path.join(rootAbs, "run-a");
      await mkdir(runA, { recursive: true });
      await writeFile(path.join(runA, "agentfs.db"), "a", "utf8");
      await writeFile(path.join(runA, "big.txt"), "x".repeat(100), "utf8");

      const casDir = path.join(rootAbs, "cas");
      await mkdir(casDir, { recursive: true });
      const shaPinned = "b".repeat(64);
      await writeFile(
        path.join(casDir, `${shaPinned}.tar.gz`),
        "z".repeat(60),
        "utf8"
      );
      await writeFile(path.join(casDir, `${shaPinned}.keep`), "", "utf8");
      await writeFile(
        path.join(casDir, `${shaPinned}.json`),
        JSON.stringify(
          {
            sha: shaPinned,
            runId: "run-pinned",
            projectId: null,
            createdAt: old.toISOString(),
            sizeBytes: 60,
          },
          null,
          2
        ),
        "utf8"
      );

      const shaUnpinned = "c".repeat(64);
      await writeFile(
        path.join(casDir, `${shaUnpinned}.tar.gz`),
        "u".repeat(70),
        "utf8"
      );
      await writeFile(
        path.join(casDir, `${shaUnpinned}.json`),
        JSON.stringify(
          {
            sha: shaUnpinned,
            runId: "run-a",
            projectId: null,
            createdAt: now.toISOString(),
            sizeBytes: 70,
          },
          null,
          2
        ),
        "utf8"
      );

      const violations = await getPolicyViolations({ rootAbs, now });
      expect(
        violations.some(
          (v) => v.id === "run-pinned" && v.severity === "warning"
        )
      ).toBe(true);
      expect(
        violations.some((v) => v.id === "runs" && v.severity === "error")
      ).toBe(true);
      expect(
        violations.some((v) => v.id === shaPinned && v.severity === "warning")
      ).toBe(true);
      expect(
        violations.some((v) => v.id === "cas" && v.severity === "error")
      ).toBe(true);
    } finally {
      process.env.ALFRED_AGENTFS_RETENTION_DAYS =
        env.ALFRED_AGENTFS_RETENTION_DAYS;
      process.env.ALFRED_AGENTFS_CAS_RETENTION_DAYS =
        env.ALFRED_AGENTFS_CAS_RETENTION_DAYS;
      process.env.ALFRED_AGENTFS_MAX_BYTES = env.ALFRED_AGENTFS_MAX_BYTES;
      process.env.ALFRED_AGENTFS_CAS_MAX_BYTES =
        env.ALFRED_AGENTFS_CAS_MAX_BYTES;
    }
  });
});
