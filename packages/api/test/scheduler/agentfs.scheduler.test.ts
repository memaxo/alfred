import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  runAgentfsCleanupTick,
  runAgentfsCompactTick,
  runAgentfsIntegrityTick,
  touchAgentfsCasLastAccessed,
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
        info: () => {},
        warn: () => {},
        error: () => {},
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
        info: () => {},
        warn: () => {},
        error: () => {},
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
        info: () => {},
        warn: () => {},
        error: () => {},
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
        info: () => {},
        warn: () => {},
        error: () => {},
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
    // mtime is recent, but createdAt is old: cleanup should use createdAt.
    await utimes(tarAbs, now, now);

    await runAgentfsCleanupTick({
      casMaxDeletes: 10,
      casRetentionDays: 7,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      now: () => now,
      retentionDays: 999,
    });

    expect(existsSync(tarAbs)).toBe(false);
    expect(existsSync(metaAbs)).toBe(false);

    const shaMtime = "c".repeat(64);
    const tarMtime = path.join(casDir, `${shaMtime}.tar.gz`);
    await writeFile(tarMtime, "tgz", "utf8");
    const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    await utimes(tarMtime, old, old);

    // No metadata: fallback to mtime.
    await runAgentfsCleanupTick({
      casMaxDeletes: 10,
      casRetentionDays: 7,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      now: () => now,
      retentionDays: 999,
    });

    expect(existsSync(tarMtime)).toBe(false);

    const sha2 = "b".repeat(64);
    const tar2 = path.join(casDir, `${sha2}.tar.gz`);
    const keep2 = path.join(casDir, `${sha2}.keep`);
    await writeFile(tar2, "tgz", "utf8");
    await writeFile(keep2, "pinned", "utf8");
    await utimes(tar2, old, old);

    await runAgentfsCleanupTick({
      casMaxDeletes: 10,
      casRetentionDays: 7,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      now: () => now,
      retentionDays: 999,
    });

    expect(existsSync(tar2)).toBe(true);
  });

  // Phase 2 hardening tests
  describe("size caps", () => {
    it("deletes oldest unpinned CAS archives to satisfy casMaxBytes", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const casDir = path.join(root, "cas");
      await mkdir(casDir, { recursive: true });

      const now = new Date("2026-01-24T00:00:00.000Z");

      // Create 3 CAS archives, each 100 bytes
      for (let i = 0; i < 3; i++) {
        const sha = `${i.toString().padStart(2, "0")}${"a".repeat(62)}`;
        const tarAbs = path.join(casDir, `${sha}.tar.gz`);
        const metaAbs = path.join(casDir, `${sha}.json`);
        const content = "x".repeat(100);
        await writeFile(tarAbs, content, "utf8");
        await writeFile(
          metaAbs,
          JSON.stringify(
            {
              createdAt: new Date(
                now.getTime() - (3 - i) * 60 * 60 * 1000
              ).toISOString(),
              projectId: null,
              runId: `run-${i}`,
              sha,
              sizeBytes: 100,
            },
            null,
            2
          ),
          "utf8"
        );
        await utimes(
          tarAbs,
          new Date(now.getTime() - (3 - i) * 60 * 60 * 1000),
          new Date(now.getTime() - (3 - i) * 60 * 60 * 1000)
        );
      }

      // Cap at 250 bytes: should delete oldest (i=0, 100 bytes), keep i=1 and i=2 (200 bytes)
      await runAgentfsCleanupTick({
        casMaxBytes: 250,
        casMaxDeletes: 10,
        casRetentionDays: 999, // Don't delete by age
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        now: () => now,
        retentionDays: 999,
      });

      // Check that oldest was deleted
      const sha0 = `00${"a".repeat(62)}`;
      expect(existsSync(path.join(casDir, `${sha0}.tar.gz`))).toBe(false);

      // Check that newer ones remain
      const sha1 = `01${"a".repeat(62)}`;
      const sha2 = `02${"a".repeat(62)}`;
      expect(existsSync(path.join(casDir, `${sha1}.tar.gz`))).toBe(true);
      expect(existsSync(path.join(casDir, `${sha2}.tar.gz`))).toBe(true);
    });

    it("never deletes pinned CAS archives to satisfy size cap", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const casDir = path.join(root, "cas");
      await mkdir(casDir, { recursive: true });

      const now = new Date("2026-01-24T00:00:00.000Z");

      // Create 2 CAS archives
      const sha1 = `01${"a".repeat(62)}`;
      const sha2 = `02${"a".repeat(62)}`;

      for (const [i, sha] of [sha1, sha2].entries()) {
        const tarAbs = path.join(casDir, `${sha}.tar.gz`);
        const metaAbs = path.join(casDir, `${sha}.json`);
        const content = "x".repeat(100);
        await writeFile(tarAbs, content, "utf8");
        await writeFile(
          metaAbs,
          JSON.stringify(
            {
              createdAt: new Date(
                now.getTime() - (2 - i) * 60 * 60 * 1000
              ).toISOString(),
              projectId: null,
              runId: `run-${i}`,
              sha,
              sizeBytes: 100,
            },
            null,
            2
          ),
          "utf8"
        );
      }

      // Pin the oldest one
      await writeFile(path.join(casDir, `${sha1}.keep`), "pinned", "utf8");

      // Cap at 50 bytes: would need to delete both, but sha1 is pinned
      await runAgentfsCleanupTick({
        casMaxBytes: 50,
        casMaxDeletes: 10,
        casRetentionDays: 999,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        now: () => now,
        retentionDays: 999,
      });

      // Pinned archive should remain
      expect(existsSync(path.join(casDir, `${sha1}.tar.gz`))).toBe(true);
      // Unpinned archive should be deleted (over cap)
      expect(existsSync(path.join(casDir, `${sha2}.tar.gz`))).toBe(false);
    });
  });

  describe("dry-run mode", () => {
    it("logs but does not delete in dry-run mode", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const runDir = path.join(root, "old-run");
      await mkdir(runDir, { recursive: true });

      const db = path.join(runDir, "agentfs.db");
      await writeFile(db, "db content here");

      const now = new Date("2026-01-24T00:00:00.000Z");
      const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      await utimes(db, old, old);

      const logs: unknown[] = [];
      await runAgentfsCleanupTick({
        deps: {
          hasFailureContext: async () => false,
        },
        dryRun: true,
        logger: {
          error: () => {},
          info: (...args: unknown[]) => logs.push(args),
          warn: () => {},
        },
        maxDeletes: 25,
        now: () => now,
        retentionDays: 1,
      });

      // Directory should still exist
      expect(existsSync(runDir)).toBe(true);
      // Should have logged the would-be deletion
      expect(logs.some((log) => String(log).includes("dry-run"))).toBe(true);
    });
  });

  describe("orphaned file cleanup", () => {
    it("cleans up orphaned CAS metadata files (no corresponding archive)", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const casDir = path.join(root, "cas");
      await mkdir(casDir, { recursive: true });

      const sha = "a".repeat(64);
      const metaAbs = path.join(casDir, `${sha}.json`);
      await writeFile(
        metaAbs,
        JSON.stringify({
          sha,
          runId: "test",
          createdAt: new Date().toISOString(),
          sizeBytes: 0,
        }),
        "utf8"
      );

      const now = new Date("2026-01-24T00:00:00.000Z");
      await runAgentfsCleanupTick({
        casMaxDeletes: 10,
        casRetentionDays: 999,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        now: () => now,
        retentionDays: 999,
      });

      expect(existsSync(metaAbs)).toBe(false);
    });

    it("cleans up orphaned CAS .keep files (no corresponding archive)", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const casDir = path.join(root, "cas");
      await mkdir(casDir, { recursive: true });

      const sha = "a".repeat(64);
      const keepAbs = path.join(casDir, `${sha}.keep`);
      await writeFile(keepAbs, "pinned", "utf8");

      const now = new Date("2026-01-24T00:00:00.000Z");
      await runAgentfsCleanupTick({
        casMaxDeletes: 10,
        casRetentionDays: 999,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        now: () => now,
        retentionDays: 999,
      });

      expect(existsSync(keepAbs)).toBe(false);
    });
  });

  describe("CAS integrity checks", () => {
    it("quarantines CAS archives with SHA mismatch", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const casDir = path.join(root, "cas");
      await mkdir(casDir, { recursive: true });

      const now = new Date("2026-01-24T00:00:00.000Z");

      // Create an archive with wrong SHA
      const wrongSha = "a".repeat(64);
      const tarAbs = path.join(casDir, `${wrongSha}.tar.gz`);
      const metaAbs = path.join(casDir, `${wrongSha}.json`);
      await writeFile(
        tarAbs,
        "corrupted content that does not match sha",
        "utf8"
      );
      await writeFile(
        metaAbs,
        JSON.stringify(
          {
            createdAt: now.toISOString(),
            projectId: null,
            runId: "test",
            sha: wrongSha,
            sizeBytes: 40,
          },
          null,
          2
        ),
        "utf8"
      );

      // Set mtime to be old enough for integrity check
      const old = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      await utimes(tarAbs, old, old);

      await runAgentfsIntegrityTick({
        checkCas: true,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        maxChecks: 10,
        minAgeMs: 0,
        now: () => now,
      });

      // Archive should be quarantined
      expect(existsSync(tarAbs)).toBe(false);
      expect(existsSync(metaAbs)).toBe(false);
      expect(existsSync(path.join(root, "quarantine", "cas"))).toBe(true);
    });

    it("leaves valid CAS archives intact", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const casDir = path.join(root, "cas");
      await mkdir(casDir, { recursive: true });

      const now = new Date("2026-01-24T00:00:00.000Z");

      // Create a valid archive with correct SHA
      const content = "valid archive content";
      const correctSha = createHash("sha256").update(content).digest("hex");
      const tarAbs = path.join(casDir, `${correctSha}.tar.gz`);
      const metaAbs = path.join(casDir, `${correctSha}.json`);
      await writeFile(tarAbs, content, "utf8");
      await writeFile(
        metaAbs,
        JSON.stringify(
          {
            createdAt: now.toISOString(),
            projectId: null,
            runId: "test",
            sha: correctSha,
            sizeBytes: content.length,
          },
          null,
          2
        ),
        "utf8"
      );

      // Set mtime to be old enough for integrity check
      const old = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      await utimes(tarAbs, old, old);

      await runAgentfsIntegrityTick({
        checkCas: true,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        maxChecks: 10,
        minAgeMs: 0,
        now: () => now,
      });

      // Archive should still exist
      expect(existsSync(tarAbs)).toBe(true);
      expect(existsSync(metaAbs)).toBe(true);
    });
  });

  describe("quarantine protection", () => {
    it("never deletes quarantined runs during cleanup", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const quarantineDir = path.join(
        root,
        "quarantine",
        "old-run-2026-01-01T00-00-00Z"
      );
      await mkdir(quarantineDir, { recursive: true });

      const quarantineDb = path.join(quarantineDir, "agentfs.db");
      await writeFile(quarantineDb, "quarantined db content");

      const now = new Date("2026-01-24T00:00:00.000Z");
      const old = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      await utimes(quarantineDb, old, old);

      await runAgentfsCleanupTick({
        deps: {
          hasFailureContext: async () => false,
        },
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        maxBytes: 1, // Force size-based cleanup
        maxDeletes: 25,
        now: () => now,
        retentionDays: 1, // Would delete by age too
      });

      // Quarantined run should still exist
      expect(existsSync(quarantineDir)).toBe(true);
      expect(existsSync(quarantineDb)).toBe(true);
    });

    it("never deletes quarantined CAS archives during cleanup", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const quarantineCasDir = path.join(root, "quarantine", "cas");
      await mkdir(quarantineCasDir, { recursive: true });

      const sha = "a".repeat(64);
      const tarAbs = path.join(
        quarantineCasDir,
        `${sha}-2026-01-01T00-00-00Z.tar.gz`
      );
      const metaAbs = path.join(
        quarantineCasDir,
        `${sha}-2026-01-01T00-00-00Z.json`
      );
      await writeFile(tarAbs, "quarantined archive", "utf8");
      await writeFile(
        metaAbs,
        JSON.stringify({
          sha,
          runId: "test",
          createdAt: "2026-01-01T00:00:00.000Z",
          sizeBytes: 20,
        }),
        "utf8"
      );

      const now = new Date("2026-01-24T00:00:00.000Z");

      await runAgentfsCleanupTick({
        casMaxBytes: 1, // Force size-based cleanup
        casMaxDeletes: 10,
        casRetentionDays: 1, // Would delete by age too
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        now: () => now,
        retentionDays: 999,
      });

      // Quarantined CAS should still exist
      expect(existsSync(tarAbs)).toBe(true);
      expect(existsSync(metaAbs)).toBe(true);
    });
  });

  describe("lastAccessedAt tracking", () => {
    it("updates lastAccessedAt via touchAgentfsCasLastAccessed", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const casDir = path.join(root, "cas");
      await mkdir(casDir, { recursive: true });

      const sha = "a".repeat(64);
      const metaAbs = path.join(casDir, `${sha}.json`);
      const createdAt = "2026-01-01T00:00:00.000Z";

      await writeFile(
        metaAbs,
        JSON.stringify(
          {
            createdAt,
            projectId: null,
            runId: "test",
            sha,
            sizeBytes: 100,
          },
          null,
          2
        ),
        "utf8"
      );

      const now = new Date("2026-01-24T00:00:00.000Z");
      await touchAgentfsCasLastAccessed({ sha, now });

      const updated = JSON.parse(await readFile(metaAbs, "utf8"));
      expect(updated.lastAccessedAt).toBeDefined();
      expect(updated.createdAt).toBe(createdAt); // Preserve createdAt
    });

    it("uses lastAccessedAt as cleanup basis when present", async () => {
      await rm(path.join(process.cwd(), ".agentfs"), {
        force: true,
        recursive: true,
      });

      const root = path.join(process.cwd(), ".agentfs");
      const casDir = path.join(root, "cas");
      await mkdir(casDir, { recursive: true });

      const now = new Date("2026-01-24T00:00:00.000Z");

      // Create archive with old createdAt but recent lastAccessedAt
      const sha = "a".repeat(64);
      const tarAbs = path.join(casDir, `${sha}.tar.gz`);
      const metaAbs = path.join(casDir, `${sha}.json`);
      await writeFile(tarAbs, "content", "utf8");
      await writeFile(
        metaAbs,
        JSON.stringify(
          {
            createdAt: "2026-01-01T00:00:00.000Z", // Old
            lastAccessedAt: now.toISOString(), // Recent
            projectId: null,
            runId: "test",
            sha,
            sizeBytes: 7,
          },
          null,
          2
        ),
        "utf8"
      );

      const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      await utimes(tarAbs, old, old); // Old mtime

      // Cleanup with 7 day retention should NOT delete because lastAccessedAt is recent
      await runAgentfsCleanupTick({
        casMaxDeletes: 10,
        casRetentionDays: 7,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        now: () => now,
        retentionDays: 999,
      });

      // Should still exist because lastAccessedAt is recent
      expect(existsSync(tarAbs)).toBe(true);
      expect(existsSync(metaAbs)).toBe(true);
    });
  });
});
