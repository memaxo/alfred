import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { LinearSyncObserver } from "../src/observers/linear";
import {
  getLinearCalls,
  resetLinearMocks,
  setLinearRateLimiterMode,
} from "./linear.mocks";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("LinearSyncObserver (init failure)", () => {
  beforeEach(() => {
    resetLinearMocks();
    setLinearRateLimiterMode("fail");
  });

  afterEach(() => {
    resetLinearMocks();
  });

  it("does not crash and does not attempt toolTicket updates when LinearRateLimiter fails to load", async () => {
    const obs = new LinearSyncObserver({
      syncIntervalMs: 5,
      space: "workspace-1",
      issueId: "ALF-123",
      authz: "test-authz",
    });

    obs.onEvent({ type: "pipeline:complete" } as never);

    // Give the observer time to attempt init + interval ticks.
    await sleep(25);
    obs.onComplete();

    expect(getLinearCalls()).toHaveLength(0);
  });
});
