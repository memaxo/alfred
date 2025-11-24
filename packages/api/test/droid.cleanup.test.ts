import { afterEach, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { cleanupDroidPendingRuns } from "../src/workers/droid-pending-cleanup";

const unregisterMock = vi.fn();
const scanMock = vi.fn();
const getMock = vi.fn();
const delMock = vi.fn();

mock.module("@alfred/agent/workflow/registry", () => ({
  runRegistry: {
    unregister: unregisterMock,
  },
}));

mock.module("@alfred/auth/redis", () => ({
  getRedis: () => ({
    scan: scanMock,
    get: getMock,
    del: delMock,
  }),
}));

describe("droid pending cleanup", () => {
  beforeEach(() => {
    unregisterMock.mockReset();
    scanMock.mockReset();
    getMock.mockReset();
    delMock.mockReset();
  });

afterEach(() => {
  // no-op
});

  it("removes stale runs and unregisters", async () => {
    const now = Date.now();
    scanMock.mockResolvedValueOnce(["0", ["droid:pending:abc"]]);
    getMock.mockResolvedValueOnce(
      JSON.stringify({
        type: "run",
        input: { prompt: "test", auto: "low", out: "text" },
        createdAt: now - 60 * 60 * 1000,
      })
    );

    await cleanupDroidPendingRuns(now);

    expect(delMock).toHaveBeenCalledWith("droid:pending:abc");
    expect(unregisterMock).toHaveBeenCalledWith("abc");
  });

  it("keeps fresh runs", async () => {
    const now = Date.now();
    scanMock.mockResolvedValueOnce(["0", ["droid:pending:fresh"]]);
    getMock.mockResolvedValueOnce(
      JSON.stringify({
        type: "run",
        input: { prompt: "test", auto: "low", out: "text" },
        createdAt: now - 1000,
      })
    );

    await cleanupDroidPendingRuns(now);

    expect(unregisterMock).not.toHaveBeenCalled();
    expect(delMock).not.toHaveBeenCalled();
  });
});
