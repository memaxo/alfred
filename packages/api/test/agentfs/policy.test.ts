import { describe, expect, it } from "bun:test";

import type {
  CasEntry,
  CasRetentionPolicy,
  RetentionPolicy,
  RunEntry,
} from "../../src/agentfs/domain";

import {
  calculateCutoffMs,
  checkCasSizeCap,
  checkRunSizeCap,
  decideCasRetention,
  decideRunRetention,
  parseCasMaxBytes,
  parseCasRetentionDays,
  parseMaxBytes,
  parseRetentionDays,
  shouldAutopinFailures,
  shouldDryRunCleanup,
  sortCasByPriority,
  sortRunsByAge,
} from "../../src/agentfs/policy";

describe("agentfs policy", () => {
  describe("parseRetentionDays", () => {
    it("returns default 14 when env is empty", () => {
      expect(parseRetentionDays({})).toBe(14);
    });

    it("returns parsed value when valid", () => {
      expect(parseRetentionDays({ ALFRED_AGENTFS_RETENTION_DAYS: "30" })).toBe(
        30
      );
    });

    it("returns default when invalid", () => {
      expect(
        parseRetentionDays({ ALFRED_AGENTFS_RETENTION_DAYS: "invalid" })
      ).toBe(14);
      expect(parseRetentionDays({ ALFRED_AGENTFS_RETENTION_DAYS: "-5" })).toBe(
        14
      );
      expect(parseRetentionDays({ ALFRED_AGENTFS_RETENTION_DAYS: "0" })).toBe(
        14
      );
    });
  });

  describe("parseCasRetentionDays", () => {
    it("returns default 30 when env is empty", () => {
      expect(parseCasRetentionDays({})).toBe(30);
    });

    it("returns parsed value when valid", () => {
      expect(
        parseCasRetentionDays({ ALFRED_AGENTFS_CAS_RETENTION_DAYS: "60" })
      ).toBe(60);
    });

    it("returns default when invalid", () => {
      expect(
        parseCasRetentionDays({ ALFRED_AGENTFS_CAS_RETENTION_DAYS: "invalid" })
      ).toBe(30);
    });
  });

  describe("parseMaxBytes", () => {
    it("returns null when env is empty", () => {
      expect(parseMaxBytes({})).toBeNull();
    });

    it("returns parsed value when valid", () => {
      expect(parseMaxBytes({ ALFRED_AGENTFS_MAX_BYTES: "10737418240" })).toBe(
        10_737_418_240
      );
    });

    it("returns null when invalid", () => {
      expect(parseMaxBytes({ ALFRED_AGENTFS_MAX_BYTES: "invalid" })).toBeNull();
      expect(parseMaxBytes({ ALFRED_AGENTFS_MAX_BYTES: "-100" })).toBeNull();
      expect(parseMaxBytes({ ALFRED_AGENTFS_MAX_BYTES: "0" })).toBeNull();
    });
  });

  describe("parseCasMaxBytes", () => {
    it("returns null when env is empty", () => {
      expect(parseCasMaxBytes({})).toBeNull();
    });

    it("returns parsed value when valid", () => {
      expect(
        parseCasMaxBytes({ ALFRED_AGENTFS_CAS_MAX_BYTES: "53687091200" })
      ).toBe(53_687_091_200);
    });
  });

  describe("shouldDryRunCleanup", () => {
    it("returns false when env is empty", () => {
      expect(shouldDryRunCleanup({})).toBe(false);
    });

    it("returns true when set to 1", () => {
      expect(shouldDryRunCleanup({ ALFRED_AGENTFS_CLEANUP_DRY_RUN: "1" })).toBe(
        true
      );
    });

    it("returns false for other values", () => {
      expect(
        shouldDryRunCleanup({ ALFRED_AGENTFS_CLEANUP_DRY_RUN: "true" })
      ).toBe(false);
      expect(shouldDryRunCleanup({ ALFRED_AGENTFS_CLEANUP_DRY_RUN: "0" })).toBe(
        false
      );
    });
  });

  describe("shouldAutopinFailures", () => {
    it("returns true when env is empty", () => {
      expect(shouldAutopinFailures({})).toBe(true);
    });

    it("returns false when set to 0", () => {
      expect(
        shouldAutopinFailures({ ALFRED_AGENTFS_AUTOPIN_FAILURES: "0" })
      ).toBe(false);
    });

    it("returns true for other values", () => {
      expect(
        shouldAutopinFailures({ ALFRED_AGENTFS_AUTOPIN_FAILURES: "1" })
      ).toBe(true);
      expect(
        shouldAutopinFailures({ ALFRED_AGENTFS_AUTOPIN_FAILURES: "true" })
      ).toBe(true);
    });
  });

  describe("calculateCutoffMs", () => {
    it("calculates correct cutoff for retention days", () => {
      const nowMs = new Date("2026-01-24T00:00:00Z").getTime();
      const cutoff = calculateCutoffMs(nowMs, 14);

      // 14 days = 14 * 24 * 60 * 60 * 1000 = 1,209,600,000 ms
      expect(nowMs - cutoff).toBe(14 * 24 * 60 * 60 * 1000);
    });
  });

  describe("decideRunRetention", () => {
    const policy: RetentionPolicy = {
      maxBytes: null,
      maxDeletes: 10,
      retentionDays: 14,
    };

    const nowMs = new Date("2026-01-24T00:00:00Z").getTime();
    const cutoffMs = calculateCutoffMs(nowMs, 14);

    it("keeps pinned runs regardless of age", () => {
      const entry: RunEntry = {
        dir: "/agentfs/old-run",
        mtimeMs: nowMs - 30 * 24 * 60 * 60 * 1000, // 30 days old
        runId: "old-run",
        sizeBytes: 1000,
      };

      const decision = decideRunRetention(
        entry,
        policy,
        { cutoffMs, hasOverride: false, nowMs, overrideDays: null },
        { hasFailureContext: false, isPinned: true }
      );

      expect(decision.action).toBe("keep");
      expect(decision.details.type).toBe("keep");
    });

    it("keeps recent runs", () => {
      const entry: RunEntry = {
        dir: "/agentfs/recent-run",
        mtimeMs: nowMs - 7 * 24 * 60 * 60 * 1000, // 7 days old
        runId: "recent-run",
        sizeBytes: 1000,
      };

      const decision = decideRunRetention(
        entry,
        policy,
        { cutoffMs, hasOverride: false, nowMs, overrideDays: null },
        { hasFailureContext: false, isPinned: false }
      );

      expect(decision.action).toBe("keep");
    });

    it("autopins old runs with failure context", () => {
      const entry: RunEntry = {
        dir: "/agentfs/failed-run",
        mtimeMs: nowMs - 20 * 24 * 60 * 60 * 1000, // 20 days old
        runId: "failed-run",
        sizeBytes: 1000,
      };

      const decision = decideRunRetention(
        entry,
        policy,
        { cutoffMs, hasOverride: false, nowMs, overrideDays: null },
        { hasFailureContext: true, isPinned: false }
      );

      expect(decision.action).toBe("autopin");
      expect(decision.details.type).toBe("autopin");
    });

    it("deletes old runs without failure context", () => {
      const entry: RunEntry = {
        dir: "/agentfs/old-run",
        mtimeMs: nowMs - 20 * 24 * 60 * 60 * 1000, // 20 days old
        runId: "old-run",
        sizeBytes: 1000,
      };

      const decision = decideRunRetention(
        entry,
        policy,
        { cutoffMs, hasOverride: false, nowMs, overrideDays: null },
        { hasFailureContext: false, isPinned: false }
      );

      expect(decision.action).toBe("delete");
      expect(decision.details.type).toBe("age");
    });

    it("respects retention override", () => {
      const entry: RunEntry = {
        dir: "/agentfs/override-run",
        mtimeMs: nowMs - 20 * 24 * 60 * 60 * 1000, // 20 days old
        runId: "override-run",
        sizeBytes: 1000,
      };

      // With 30 day override, 20 days is still within retention
      const decision = decideRunRetention(
        entry,
        policy,
        { cutoffMs, hasOverride: true, nowMs, overrideDays: 30 },
        { hasFailureContext: false, isPinned: false }
      );

      expect(decision.action).toBe("keep");
    });
  });

  describe("decideCasRetention", () => {
    const policy: CasRetentionPolicy = {
      casMaxBytes: null,
      maxBytes: null,
      maxDeletes: 10,
      retentionDays: 30,
    };

    const nowMs = new Date("2026-01-24T00:00:00Z").getTime();
    const cutoffMs = calculateCutoffMs(nowMs, 30);

    const baseEntry: CasEntry = {
      abs: "/agentfs/cas/sha.tar.gz",
      basis: "createdAt",
      basisMs: nowMs - 40 * 24 * 60 * 60 * 1000, // 40 days old
      metaAbs: "/agentfs/cas/sha.json",
      mtimeMs: nowMs - 40 * 24 * 60 * 60 * 1000,
      sha: "a".repeat(64),
      sizeBytes: 1000,
    };

    it("keeps pinned CAS archives", () => {
      const decision = decideCasRetention(
        baseEntry,
        policy,
        { cutoffMs, nowMs },
        { isPinned: true }
      );

      expect(decision.action).toBe("keep");
    });

    it("keeps recent CAS archives", () => {
      const recentEntry: CasEntry = {
        ...baseEntry,
        basisMs: nowMs - 10 * 24 * 60 * 60 * 1000, // 10 days old
      };

      const decision = decideCasRetention(
        recentEntry,
        policy,
        { cutoffMs, nowMs },
        { isPinned: false }
      );

      expect(decision.action).toBe("keep");
    });

    it("deletes old CAS archives", () => {
      const decision = decideCasRetention(
        baseEntry,
        policy,
        { cutoffMs, nowMs },
        { isPinned: false }
      );

      expect(decision.action).toBe("delete");
      expect(decision.details.type).toBe("age");
    });
  });

  describe("checkCasSizeCap", () => {
    const entry: CasEntry = {
      abs: "/agentfs/cas/sha.tar.gz",
      basis: "createdAt",
      basisMs: Date.now(),
      metaAbs: "/agentfs/cas/sha.json",
      mtimeMs: Date.now(),
      sha: "a".repeat(64),
      sizeBytes: 1000,
    };

    it("returns shouldDelete false when under cap", () => {
      const result = checkCasSizeCap(entry, 5000, 4000);
      expect(result.shouldDelete).toBe(false);
    });

    it("returns shouldDelete true when over cap", () => {
      const result = checkCasSizeCap(entry, 5000, 6000);
      expect(result.shouldDelete).toBe(true);
      expect(result.details?.type).toBe("size_cap");
      expect(result.details?.maxBytes).toBe(5000);
    });
  });

  describe("checkRunSizeCap", () => {
    const entry: RunEntry = {
      dir: "/agentfs/run",
      mtimeMs: Date.now(),
      runId: "run",
      sizeBytes: 1000,
    };

    it("returns shouldDelete false when under cap", () => {
      const result = checkRunSizeCap(entry, 5000, 4000);
      expect(result.shouldDelete).toBe(false);
    });

    it("returns shouldDelete true when over cap", () => {
      const result = checkRunSizeCap(entry, 5000, 6000);
      expect(result.shouldDelete).toBe(true);
      expect(result.details?.type).toBe("size_cap");
    });
  });

  describe("sortCasByPriority", () => {
    it("sorts by age (oldest first)", () => {
      const now = Date.now();
      const entries: CasEntry[] = [
        {
          abs: "",
          basis: "createdAt",
          basisMs: now - 1000,
          metaAbs: "",
          mtimeMs: now,
          sha: "a",
          sizeBytes: 100,
        },
        {
          abs: "",
          basis: "createdAt",
          basisMs: now - 3000,
          metaAbs: "",
          mtimeMs: now,
          sha: "b",
          sizeBytes: 100,
        },
        {
          abs: "",
          basis: "createdAt",
          basisMs: now - 2000,
          metaAbs: "",
          mtimeMs: now,
          sha: "c",
          sizeBytes: 100,
        },
      ];

      const sorted = sortCasByPriority(entries);
      expect(sorted[0].sha).toBe("b"); // oldest
      expect(sorted[1].sha).toBe("c");
      expect(sorted[2].sha).toBe("a"); // newest
    });

    it("sorts by size when ages are equal (larger first)", () => {
      const now = Date.now();
      const entries: CasEntry[] = [
        {
          abs: "",
          basis: "createdAt",
          basisMs: now - 1000,
          metaAbs: "",
          mtimeMs: now,
          sha: "a",
          sizeBytes: 100,
        },
        {
          abs: "",
          basis: "createdAt",
          basisMs: now - 1000,
          metaAbs: "",
          mtimeMs: now,
          sha: "b",
          sizeBytes: 500,
        },
        {
          abs: "",
          basis: "createdAt",
          basisMs: now - 1000,
          metaAbs: "",
          mtimeMs: now,
          sha: "c",
          sizeBytes: 300,
        },
      ];

      const sorted = sortCasByPriority(entries);
      expect(sorted[0].sha).toBe("b"); // largest
      expect(sorted[1].sha).toBe("c");
      expect(sorted[2].sha).toBe("a"); // smallest
    });
  });

  describe("sortRunsByAge", () => {
    it("sorts by mtime (oldest first)", () => {
      const now = Date.now();
      const entries: RunEntry[] = [
        { dir: "", mtimeMs: now - 1000, runId: "a", sizeBytes: 100 },
        { dir: "", mtimeMs: now - 3000, runId: "b", sizeBytes: 100 },
        { dir: "", mtimeMs: now - 2000, runId: "c", sizeBytes: 100 },
      ];

      const sorted = sortRunsByAge(entries);
      expect(sorted[0].runId).toBe("b"); // oldest
      expect(sorted[1].runId).toBe("c");
      expect(sorted[2].runId).toBe("a"); // newest
    });
  });
});
