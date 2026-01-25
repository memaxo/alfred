import { describe, expect, it, mock, vi } from "bun:test";

const cleanupOldCodexExecutions = vi.fn().mockResolvedValue(3);

mock.module("@alfred/db/repo/codex-learning", () => ({
  cleanupOldCodexExecutions,
}));

import { runEnrichCleanupTick } from "../../src/scheduler/enrich";

describe("enrich cleanup scheduler", () => {
  it("deletes old codex execution nodes", async () => {
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();

    const now = new Date("2026-01-24T00:00:00.000Z");
    await runEnrichCleanupTick({
      intervalMs: 1,
      jitterMs: 0,
      logger: { info, warn, error },
      maxDeletes: 10,
      now: () => now,
      retentionDays: 7,
    });

    expect(cleanupOldCodexExecutions).toHaveBeenCalledWith({
      maxDeletes: 10,
      olderThan: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    });
    expect(info).toHaveBeenCalledWith(
      "enrich_cleanup_deleted",
      expect.objectContaining({ deleted: 3, retentionDays: 7 })
    );
  });
});
