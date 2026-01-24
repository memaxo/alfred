import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  runAgentfsCleanupTick,
  runAgentfsCompactTick,
  runAgentfsIntegrityTick,
} from "../../src/scheduler/agentfs";

describe("agentfs cleanup scheduler", () => {
  const prev = process.env.ALFRED_AGENTFS_AUTOPIN_FAILURES;

  beforeAll(() => {
    process.env.ALFRED_AGENTFS_AUTOPIN_FAILURES = "1";
  });

  afterAll(async () => {
    if (typeof prev === "string") {
      process.env.ALFRED_AGENTFS_AUTOPIN_FAILURES = prev;
    } else {
      delete process.env.ALFRED_AGENTFS_AUTOPIN_FAILURES;
    }

    await rm(path.join(process.cwd(), ".agentfs"), {
      force: true,
      recursive: true,
    });
  });

  it("auto-pins runs with failure contexts instead of deleting", async () => {
    await rm(path.join(process.cwd(), ".agentfs"), {
      force: true,
      recursive: true,
    });

    const root = path.join(process.cwd(), ".agentfs");
    const failDir = path.join(root, "fail-run");
    const okDir = path.join(root, "ok-run");

    await mkdir(failDir, { recursive: true });
    await mkdir(okDir, { recursive: true });

    const failDb = path.join(failDir, "agentfs.db");
    const okDb = path.join(okDir, "agentfs.db");
    await writeFile(failDb, "db");
    await writeFile(okDb, "db");

    const now = new Date("2026-01-24T00:00:00.000Z");
    const old = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    await utimes(failDb, old, old);
    await utimes(okDb, old, old);

    await runAgentfsCleanupTick({
      deps: {
        hasFailureContext: async (runId: string) => runId === "fail-run",
      },
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      maxDeletes: 25,
      now: () => now,
      retentionDays: 1,
    });

    expect(existsSync(failDir)).toBe(true);
    expect(existsSync(path.join(failDir, ".keep"))).toBe(true);
    expect(existsSync(okDir)).toBe(false);
  });

  it("respects per-run .retention overrides", async () => {
    await rm(path.join(process.cwd(), ".agentfs"), {
      force: true,
      recursive: true,
    });

    const root = path.join(process.cwd(), ".agentfs");
    const longDir = path.join(root, "long-run");
    const shortDir = path.join(root, "short-run");

    await mkdir(longDir, { recursive: true });
    await mkdir(shortDir, { recursive: true });

    const longDb = path.join(longDir, "agentfs.db");
    const shortDb = path.join(shortDir, "agentfs.db");
    await writeFile(longDb, "db");
    await writeFile(shortDb, "db");

    await writeFile(path.join(longDir, ".retention"), "10", "utf8");
    await writeFile(path.join(shortDir, ".retention"), "1", "utf8");

    const now = new Date("2026-01-24T00:00:00.000Z");
    const old5d = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    await utimes(longDb, old5d, old5d);
    await utimes(shortDb, old5d, old5d);

    await runAgentfsCleanupTick({
      deps: {
        hasFailureContext: async () => false,
      },
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      maxDeletes: 25,
      now: () => now,
      retentionDays: 2,
    });

    expect(existsSync(longDir)).toBe(true);
    expect(existsSync(shortDir)).toBe(false);
  });

  it("quarantines runs with corrupt sqlite databases", async () => {
    await rm(path.join(process.cwd(), ".agentfs"), {
      force: true,
      recursive: true,
    });

    const root = path.join(process.cwd(), ".agentfs");
    const badDir = path.join(root, "bad-run");
    await mkdir(badDir, { recursive: true });

    const badDb = path.join(badDir, "agentfs.db");
    await writeFile(badDb, "not a sqlite db", "utf8");

    const now = new Date("2026-01-24T00:00:00.000Z");
    const old = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    await utimes(badDb, old, old);

    await runAgentfsIntegrityTick({
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      maxChecks: 10,
      minAgeMs: 0,
      now: () => now,
    });

    expect(existsSync(badDir)).toBe(false);
    const quarantine = path.join(root, "quarantine");
    expect(existsSync(quarantine)).toBe(true);
  });

  it("compacts old sqlite databases without deleting", async () => {
    await rm(path.join(process.cwd(), ".agentfs"), {
      force: true,
      recursive: true,
    });

    const root = path.join(process.cwd(), ".agentfs");
    const runDir = path.join(root, "compact-run");
    await mkdir(runDir, { recursive: true });

    const dbPath = path.join(runDir, "agentfs.db");
    const db = new Database(dbPath);
    try {
      db.run("CREATE TABLE t(x INTEGER)");
      db.run("INSERT INTO t(x) VALUES (1)");
    } finally {
      db.close();
    }

    const now = new Date("2026-01-24T00:00:00.000Z");
    const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    await utimes(dbPath, old, old);

    await runAgentfsCompactTick({
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      maxRuns: 5,
      minAgeDays: 1,
      now: () => now,
      vacuum: false,
    });

    expect(existsSync(dbPath)).toBe(true);
  });

  it("cleans up old CAS archives (unless pinned)", async () => {
    await rm(path.join(process.cwd(), ".agentfs"), {
      force: true,
      recursive: true,
    });

    const root = path.join(process.cwd(), ".agentfs");
    const casDir = path.join(root, "cas");
    await mkdir(casDir, { recursive: true });

    const sha = "a".repeat(64);
    const tarAbs = path.join(casDir, `${sha}.tar.gz`);
    const metaAbs = path.join(casDir, `${sha}.json`);
    await writeFile(tarAbs, "tgz", "utf8");
    await writeFile(
      metaAbs,
      JSON.stringify(
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          projectId: null,
          runId: "run-1",
          sha,
          sizeBytes: 3,
        },
        null,
        2
      ),
      "utf8"
    );

    const now = new Date("2026-01-24T00:00:00.000Z");
    const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    await utimes(tarAbs, old, old);

    await runAgentfsCleanupTick({
      casMaxDeletes: 10,
      casRetentionDays: 1,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      now: () => now,
      retentionDays: 999,
    });

    expect(existsSync(tarAbs)).toBe(false);
    expect(existsSync(metaAbs)).toBe(false);

    const sha2 = "b".repeat(64);
    const tar2 = path.join(casDir, `${sha2}.tar.gz`);
    const keep2 = path.join(casDir, `${sha2}.keep`);
    await writeFile(tar2, "tgz", "utf8");
    await writeFile(keep2, "pinned", "utf8");
    await utimes(tar2, old, old);

    await runAgentfsCleanupTick({
      casMaxDeletes: 10,
      casRetentionDays: 1,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      now: () => now,
      retentionDays: 999,
    });

    expect(existsSync(tar2)).toBe(true);
  });
});
