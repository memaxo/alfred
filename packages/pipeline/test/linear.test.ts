import { afterEach, describe, expect, it, mock } from "bun:test";

type TicketCall = {
  input: {
    space: string;
    action: string;
    issueId: string;
    description: string;
    authz: string;
  };
};

const calls: TicketCall[] = [];
let throttleCount = 0;

mock.module("@alfred/agent/orchestrator/linear-rate-limiter", () => ({
  LinearRateLimiter: class LinearRateLimiter {
    throttle(): Promise<void> {
      throttleCount += 1;
      return Promise.resolve();
    }
  },
}));

mock.module("@alfred/agent/orchestrator/tool/ticket", () => ({
  toolTicket: {
    execute: async (args: TicketCall) => {
      calls.push(args);
      return;
    },
  },
}));

import { LinearSyncObserver } from "../src/observers/linear";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn: () => boolean, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fn()) {
      return;
    }
    await sleep(5);
  }
  throw new Error("waitFor: timeout");
}

describe("LinearSyncObserver", () => {
  afterEach(() => {
    calls.length = 0;
    throttleCount = 0;
  });

  it("flushes buffered updates on interval", async () => {
    const obs = new LinearSyncObserver({
      syncIntervalMs: 10,
      issueId: "ALF-123",
      authz: "test-authz",
    });

    obs.onEvent({ type: "stage:enter", stage: "execute" } as never);

    await waitFor(() => calls.length > 0, 250);
    obs.onComplete();

    expect(calls.length).toBeGreaterThan(0);
    expect(throttleCount).toBe(calls.length);
    expect(calls[0]?.input.issueId).toBe("ALF-123");
    expect(calls[0]?.input.authz).toBe("test-authz");
  });

  it("flushes immediately on pipeline completion", async () => {
    const obs = new LinearSyncObserver({
      syncIntervalMs: 60_000,
      issueId: "ALF-123",
      authz: "test-authz",
    });

    obs.onEvent({ type: "pipeline:complete" } as never);

    await waitFor(() => calls.length > 0, 250);
    obs.onComplete();

    expect(calls.length).toBeGreaterThan(0);
    expect(throttleCount).toBe(calls.length);
    expect(calls[0]?.input.action).toBe("update");
    expect(calls[0]?.input.description).toBe("Done");
  });

  it("does not drop updates when pipeline:complete fires immediately after construction", async () => {
    const obs = new LinearSyncObserver({
      syncIntervalMs: 60_000,
      issueId: "ALF-123",
      authz: "test-authz",
    });

    // Intentionally fire completion immediately (before async init resolves).
    obs.onEvent({ type: "pipeline:complete" } as never);

    await waitFor(() => calls.length > 0, 250);
    obs.onComplete();

    expect(calls[0]?.input.action).toBe("update");
    expect(calls[0]?.input.description).toBe("Done");
  });

  it("flushes status+comment immediately on pipeline failure", async () => {
    const obs = new LinearSyncObserver({
      syncIntervalMs: 60_000,
      issueId: "ALF-123",
      authz: "test-authz",
    });

    obs.onEvent({
      type: "pipeline:failed",
      lastStage: "execute",
      error: "boom",
    } as never);

    await waitFor(() => calls.length === 2, 250);
    obs.onComplete();

    expect(throttleCount).toBe(2);
    expect(calls[0]?.input.action).toBe("comment");
    expect(calls[0]?.input.description).toContain("Pipeline failed at execute");
    expect(calls[1]?.input.action).toBe("update");
    expect(calls[1]?.input.description).toBe("Cancelled");
  });
});
