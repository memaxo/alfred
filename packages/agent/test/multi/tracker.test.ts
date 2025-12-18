import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { AgentId } from "@alfred/agent/orchestrator/multi/spawn";
import type { TrackerState } from "@alfred/agent/orchestrator/multi/tracker";
import {
  __internals,
  detectNeedsGuidance,
  detectStuck,
  getStuckDetectionDefaults,
  updateTracker,
} from "@alfred/agent/orchestrator/multi/tracker";

function emptyState(): TrackerState {
  return { agents: {}, waves: {} };
}

describe("tracker.updateTracker", () => {
  it("initialises agent state on first event", () => {
    const now = Date.now();
    const state = emptyState();
    const next = updateTracker(state, {
      type: "codex/thought",
      agentId: "agent-1" as AgentId,
      text: "thinking",
      ts: now,
    });

    const agent = next.agents["agent-1" as AgentId];
    expect(agent).toBeDefined();
    expect(agent.status).toBe("running");
    expect(agent.lastEventTs).toBe(now);
  });

  it("records commands and status transitions", () => {
    const base = emptyState();
    const ts1 = Date.now();
    const ts2 = ts1 + 1000;

    const afterRun = updateTracker(base, {
      type: "codex/command",
      agentId: "agent-2" as AgentId,
      command: "bun test",
      status: "running",
      ts: ts1,
    });

    const afterComplete = updateTracker(afterRun, {
      type: "codex/command",
      agentId: "agent-2" as AgentId,
      command: "bun test",
      status: "completed",
      ts: ts2,
    });

    const agent = afterComplete.agents["agent-2" as AgentId];
    expect(agent.status).toBe("completed");
    expect(agent.commands.length).toBe(2);
    expect(agent.lastEventTs).toBe(ts2);
  });

  it("tracks file changes", () => {
    const base = emptyState();
    const ts = Date.now();

    const next = updateTracker(base, {
      type: "codex/file",
      agentId: "agent-3" as AgentId,
      path: "src/app.ts",
      kind: "file",
      ts,
    });

    const agent = next.agents["agent-3" as AgentId];
    expect(agent.filesChanged).toContain("src/app.ts");
  });

  it("updates notice timestamps without altering original state", () => {
    const state = emptyState();
    const next = updateTracker(state, {
      type: "notice",
      agentId: "agent-4" as AgentId,
      message: "ping",
      ts: 123,
    });

    expect(next).not.toBe(state);
    expect(next.agents["agent-4" as AgentId]?.lastEventTs).toBe(123);
    expect(state.agents["agent-4" as AgentId]).toBeUndefined();
  });
});

describe("tracker.detectStuck", () => {
  it("returns false for fresh agent activity", () => {
    const now = Date.now();
    const state = updateTracker(emptyState(), {
      type: "codex/thought",
      agentId: "agent-4" as AgentId,
      text: "ok",
      ts: now,
    });

    expect(detectStuck(state, "agent-4" as AgentId, now + 1000)).toBe(false);
  });

  it("detects no-progress timeout", () => {
    const now = Date.now();
    const state = updateTracker(emptyState(), {
      type: "codex/thought",
      agentId: "agent-5" as AgentId,
      text: "stalled",
      ts: now,
    });

    const stuck = detectStuck(state, "agent-5" as AgentId, now + 200_000, {
      noProgressMs: 120_000,
    });
    expect(stuck).toBe(true);
  });

  it("detects repeated commands", () => {
    let state = emptyState();
    const baseTs = Date.now();

    for (let i = 0; i < 6; i += 1) {
      state = updateTracker(state, {
        type: "codex/command",
        agentId: "agent-6" as AgentId,
        command: "bun test",
        status: "running",
        ts: baseTs + i,
      });
    }

    const stuck = detectStuck(state, "agent-6" as AgentId, baseTs + 10_000, {
      maxRepeats: 5,
    });
    expect(stuck).toBe(true);
  });

  it("detects file flip-flops", () => {
    let state = emptyState();
    const baseTs = Date.now();

    for (let i = 0; i < 5; i += 1) {
      state = updateTracker(state, {
        type: "codex/file",
        agentId: "agent-7" as AgentId,
        path: "src/main.ts",
        kind: "file",
        ts: baseTs + i,
      });
    }

    const stuck = detectStuck(state, "agent-7" as AgentId, baseTs + 10_000, {
      maxFileFlipFlops: 4,
    });
    expect(stuck).toBe(true);
  });
});

describe("tracker.detectNeedsGuidance", () => {
  it("returns false when agent is unknown", () => {
    const state = emptyState();
    const needs = detectNeedsGuidance(state, "agent-x" as AgentId, [
      "need guidance",
    ]);
    expect(needs).toBe(false);
  });

  it("returns false when no thoughts provided", () => {
    const now = Date.now();
    const state = updateTracker(emptyState(), {
      type: "codex/thought",
      agentId: "agent-8" as AgentId,
      text: "thinking",
      ts: now,
    });
    const needs = detectNeedsGuidance(state, "agent-8" as AgentId, []);
    expect(needs).toBe(false);
  });

  it("detects guidance phrases in thoughts", () => {
    const now = Date.now();
    const state = updateTracker(emptyState(), {
      type: "codex/thought",
      agentId: "agent-9" as AgentId,
      text: "I am unsure how to proceed on this change.",
      ts: now,
    });

    const needs = detectNeedsGuidance(state, "agent-9" as AgentId, [
      "I am UNSURE how to proceed on this change.",
    ]);

    expect(needs).toBe(true);
  });
});

describe("tracker internals", () => {
  it("normalises missing timestamps to Date.now", () => {
    const nowSpy = spyOn(Date, "now").mockReturnValue(999);
    const { normaliseTime } = __internals;
    expect(normaliseTime(undefined)).toBe(999);
    nowSpy.mockRestore();
  });

  it("ensures ensureAgent preserves latest timestamps", () => {
    const { ensureAgent } = __internals;
    const state = emptyState();
    ensureAgent(state, "agent-10" as AgentId, "task" as any, 10);
    ensureAgent(state, "agent-10" as AgentId, "task" as any, 20);
    expect(state.agents["agent-10" as AgentId]?.lastEventTs).toBe(20);
  });
});

describe("getStuckDetectionDefaults", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars
    process.env.STUCK_NO_PROGRESS_MS = undefined;
    process.env.STUCK_MAX_REPEATS = undefined;
    process.env.STUCK_MAX_FILE_FLIP_FLOPS = undefined;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it("returns hardcoded defaults when env vars not set", () => {
    const defaults = getStuckDetectionDefaults();
    expect(defaults.noProgressMs).toBe(120_000);
    expect(defaults.maxRepeats).toBe(5);
    expect(defaults.maxFileFlipFlops).toBe(4);
  });

  it("reads noProgressMs from STUCK_NO_PROGRESS_MS env var", () => {
    process.env.STUCK_NO_PROGRESS_MS = "60000";
    const defaults = getStuckDetectionDefaults();
    expect(defaults.noProgressMs).toBe(60_000);
  });

  it("reads maxRepeats from STUCK_MAX_REPEATS env var", () => {
    process.env.STUCK_MAX_REPEATS = "10";
    const defaults = getStuckDetectionDefaults();
    expect(defaults.maxRepeats).toBe(10);
  });

  it("reads maxFileFlipFlops from STUCK_MAX_FILE_FLIP_FLOPS env var", () => {
    process.env.STUCK_MAX_FILE_FLIP_FLOPS = "8";
    const defaults = getStuckDetectionDefaults();
    expect(defaults.maxFileFlipFlops).toBe(8);
  });

  it("reads all env vars when set", () => {
    process.env.STUCK_NO_PROGRESS_MS = "300000";
    process.env.STUCK_MAX_REPEATS = "3";
    process.env.STUCK_MAX_FILE_FLIP_FLOPS = "2";
    const defaults = getStuckDetectionDefaults();
    expect(defaults.noProgressMs).toBe(300_000);
    expect(defaults.maxRepeats).toBe(3);
    expect(defaults.maxFileFlipFlops).toBe(2);
  });
});

describe("detectStuck with custom thresholds", () => {
  it("uses env var defaults when no options provided", () => {
    const originalEnv = process.env.STUCK_NO_PROGRESS_MS;
    process.env.STUCK_NO_PROGRESS_MS = "60000"; // 60s instead of 120s

    const now = Date.now();
    const state = updateTracker(emptyState(), {
      type: "codex/thought",
      agentId: "agent-env" as AgentId,
      text: "thinking",
      ts: now,
    });

    // Should be stuck after 60s (env var threshold) but not 50s
    expect(detectStuck(state, "agent-env" as AgentId, now + 50_000)).toBe(
      false
    );
    expect(detectStuck(state, "agent-env" as AgentId, now + 70_000)).toBe(true);

    process.env.STUCK_NO_PROGRESS_MS = originalEnv;
  });

  it("explicit options override env var defaults", () => {
    const originalEnv = process.env.STUCK_NO_PROGRESS_MS;
    process.env.STUCK_NO_PROGRESS_MS = "60000"; // 60s from env

    const now = Date.now();
    const state = updateTracker(emptyState(), {
      type: "codex/thought",
      agentId: "agent-override" as AgentId,
      text: "thinking",
      ts: now,
    });

    // Explicit option (30s) should override env var (60s)
    expect(
      detectStuck(state, "agent-override" as AgentId, now + 25_000, {
        noProgressMs: 30_000,
      })
    ).toBe(false);
    expect(
      detectStuck(state, "agent-override" as AgentId, now + 35_000, {
        noProgressMs: 30_000,
      })
    ).toBe(true);

    process.env.STUCK_NO_PROGRESS_MS = originalEnv;
  });

  it("allows longer timeout for complex tasks", () => {
    const now = Date.now();
    const state = updateTracker(emptyState(), {
      type: "codex/thought",
      agentId: "agent-complex" as AgentId,
      text: "complex analysis",
      ts: now,
    });

    // With longer timeout (5 minutes), should not be stuck after 3 minutes
    expect(
      detectStuck(state, "agent-complex" as AgentId, now + 180_000, {
        noProgressMs: 300_000,
      })
    ).toBe(false);

    // But should be stuck after 6 minutes
    expect(
      detectStuck(state, "agent-complex" as AgentId, now + 360_000, {
        noProgressMs: 300_000,
      })
    ).toBe(true);
  });

  it("allows more repeats for iterative tasks", () => {
    let state = emptyState();
    const baseTs = Date.now();

    // Run same command 8 times (more than default 5)
    for (let i = 0; i < 8; i += 1) {
      state = updateTracker(state, {
        type: "codex/command",
        agentId: "agent-iterative" as AgentId,
        command: "bun test",
        status: "running",
        ts: baseTs + i,
      });
    }

    // With higher repeat threshold (10), should not be stuck
    expect(
      detectStuck(state, "agent-iterative" as AgentId, baseTs + 10_000, {
        maxRepeats: 10,
      })
    ).toBe(false);

    // But with default threshold, it would be
    expect(
      detectStuck(state, "agent-iterative" as AgentId, baseTs + 10_000, {
        maxRepeats: 5,
      })
    ).toBe(true);
  });

  it("allows more file changes for refactoring tasks", () => {
    let state = emptyState();
    const baseTs = Date.now();

    // Touch same file 6 times (more than default 4)
    for (let i = 0; i < 6; i += 1) {
      state = updateTracker(state, {
        type: "codex/file",
        agentId: "agent-refactor" as AgentId,
        path: "src/main.ts",
        kind: "file",
        ts: baseTs + i,
      });
    }

    // With higher flip-flop threshold (8), should not be stuck
    expect(
      detectStuck(state, "agent-refactor" as AgentId, baseTs + 10_000, {
        maxFileFlipFlops: 8,
      })
    ).toBe(false);

    // But with default threshold, it would be
    expect(
      detectStuck(state, "agent-refactor" as AgentId, baseTs + 10_000, {
        maxFileFlipFlops: 4,
      })
    ).toBe(true);
  });
});
