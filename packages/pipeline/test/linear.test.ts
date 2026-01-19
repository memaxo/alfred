import { afterEach, describe, expect, it } from "bun:test";
import { LinearSyncObserver } from "../src/observers/linear";
import {
  getLinearCalls,
  getLinearThrottleCount,
  resetLinearMocks,
} from "./linear.mocks";

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
    resetLinearMocks();
  });

  it("flushes buffered updates on interval", async () => {
    const obs = new LinearSyncObserver({
      syncIntervalMs: 10,
      space: "workspace-1",
      issueId: "ALF-123",
      authz: "test-authz",
    });

    obs.onEvent({ type: "stage:enter", stage: "execute" } as never);

    await waitFor(() => getLinearCalls().length > 0, 250);
    obs.onComplete();

    const calls = getLinearCalls();
    expect(calls.length).toBeGreaterThan(0);
    expect(getLinearThrottleCount()).toBe(calls.length);
    expect(calls[0]?.input.space).toBe("workspace-1");
    expect(calls[0]?.input.issueId).toBe("ALF-123");
    expect(calls[0]?.input.authz).toBe("test-authz");
    expect(calls[0]?.input.action).toBe("set-started");
  });

  it("flushes immediately on pipeline completion", async () => {
    const obs = new LinearSyncObserver({
      syncIntervalMs: 60_000,
      space: "workspace-1",
      issueId: "ALF-123",
      authz: "test-authz",
    });

    obs.onEvent({ type: "pipeline:complete" } as never);

    await waitFor(() => getLinearCalls().length > 0, 250);
    obs.onComplete();

    const calls = getLinearCalls();
    expect(calls.length).toBeGreaterThan(0);
    expect(getLinearThrottleCount()).toBe(calls.length);
    expect(calls[0]?.input.action).toBe("set-completed");
    expect(calls[0]?.input.issueId).toBe("ALF-123");
  });

  it("does not drop updates when pipeline:complete fires immediately after construction", async () => {
    const obs = new LinearSyncObserver({
      syncIntervalMs: 60_000,
      space: "workspace-1",
      issueId: "ALF-123",
      authz: "test-authz",
    });

    // Intentionally fire completion immediately (before async init resolves).
    obs.onEvent({ type: "pipeline:complete" } as never);

    await waitFor(() => getLinearCalls().length > 0, 250);
    obs.onComplete();

    const calls = getLinearCalls();
    expect(calls[0]?.input.action).toBe("set-completed");
    expect(calls[0]?.input.issueId).toBe("ALF-123");
  });

  it("flushes status+comment immediately on pipeline failure", async () => {
    const obs = new LinearSyncObserver({
      syncIntervalMs: 60_000,
      space: "workspace-1",
      issueId: "ALF-123",
      authz: "test-authz",
    });

    obs.onEvent({
      type: "pipeline:failed",
      lastStage: "execute",
      error: "boom",
    } as never);

    await waitFor(() => getLinearCalls().length === 2, 250);
    obs.onComplete();

    const calls = getLinearCalls();
    expect(getLinearThrottleCount()).toBe(2);
    expect(calls[0]?.input.action).toBe("comment");
    expect(calls[0]?.input.description).toContain("Pipeline failed at execute");
    expect(calls[1]?.input.action).toBe("set-cancelled");
    expect(calls[1]?.input.issueId).toBe("ALF-123");
  });

  it("starts a subtask issue when agent spawns and task map exists", async () => {
    const obs = new LinearSyncObserver({
      syncIntervalMs: 10,
      space: "workspace-1",
      issueId: "ALF-123",
      authz: "test-authz",
    });

    obs.onEvent({
      type: "context:set",
      key: "linearTaskIssueMap",
      value: { T1: "ISSUE-1" },
      timestamp: Date.now(),
    } as never);
    obs.onEvent({
      type: "agent:spawn",
      agentId: "agent-1",
      taskId: "T1",
      timestamp: Date.now(),
    } as never);

    await waitFor(() => getLinearCalls().length === 1, 250);
    obs.onComplete();

    const calls = getLinearCalls();
    expect(calls[0]?.input.action).toBe("set-started");
    expect(calls[0]?.input.issueId).toBe("ISSUE-1");
  });
});
