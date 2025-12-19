import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { AgentId } from "@alfred/agent/orchestrator/multi/spawn";
import type { TrackerState } from "@alfred/agent/orchestrator/multi/tracker";
import {
  __internals,
  clearAgentDetector,
  clearAllDetectors,
  detectStuck,
  getStuckDetectionDefaults,
  updateTracker,
} from "@alfred/agent/orchestrator/multi/tracker";

function emptyState(): TrackerState {
  return { agents: {}, waves: {} };
}

describe("tracker.updateTracker", () => {
  beforeEach(() => {
    clearAllDetectors();
  });

  afterEach(() => {
    clearAllDetectors();
  });

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
      command: "bun test src/",
      status: "running",
      ts: ts1,
    });

    // Use a different command to avoid loop detection
    const afterComplete = updateTracker(afterRun, {
      type: "codex/command",
      agentId: "agent-2" as AgentId,
      command: "bun test packages/",
      status: "completed",
      ts: ts2,
    });

    const agent = afterComplete.agents["agent-2" as AgentId];
    expect(agent.status).toBe("completed");
    expect(agent.lastEventTs).toBe(ts2);
  });

  it("tracks file changes via timestamps", () => {
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
    expect(agent.lastEventTs).toBe(ts);
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

  it("detects stuck status via LoopDetector on repeated commands", () => {
    let state = emptyState();
    const baseTs = Date.now();

    // Send same command multiple times - should trigger exact_match
    for (let i = 0; i < 3; i++) {
      state = updateTracker(state, {
        type: "codex/command",
        agentId: "agent-loop" as AgentId,
        command: "bun test",
        status: "running",
        ts: baseTs + i,
      });
    }

    const agent = state.agents["agent-loop" as AgentId];
    expect(agent.status).toBe("stuck");
  });
});

describe("tracker.detectStuck", () => {
  beforeEach(() => {
    clearAllDetectors();
  });

  afterEach(() => {
    clearAllDetectors();
  });

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

  it("detects repeated thoughts via status", () => {
    let state = emptyState();
    const baseTs = Date.now();

    // Same thought twice should mark as stuck
    state = updateTracker(state, {
      type: "codex/thought",
      agentId: "agent-6" as AgentId,
      text: "checking the same thing",
      ts: baseTs,
    });
    state = updateTracker(state, {
      type: "codex/thought",
      agentId: "agent-6" as AgentId,
      text: "checking the same thing",
      ts: baseTs + 1,
    });

    // Status should be stuck from the LoopDetector
    expect(state.agents["agent-6" as AgentId].status).toBe("stuck");
    expect(detectStuck(state, "agent-6" as AgentId, baseTs + 10_000)).toBe(true);
  });

  it("allows varied content without marking stuck", () => {
    let state = emptyState();
    const baseTs = Date.now();

    const thoughts = [
      "First analysis step",
      "Second evaluation phase",
      "Third implementation detail",
      "Fourth testing consideration",
      "Fifth deployment step",
    ];

    for (let i = 0; i < thoughts.length; i++) {
      state = updateTracker(state, {
        type: "codex/thought",
        agentId: "agent-varied" as AgentId,
        text: thoughts[i],
        ts: baseTs + i * 1000,
      });
    }

    const agent = state.agents["agent-varied" as AgentId];
    expect(agent.status).toBe("running");
    expect(detectStuck(state, "agent-varied" as AgentId, baseTs + 10_000)).toBe(false);
  });
});

describe("tracker internals", () => {
  beforeEach(() => {
    clearAllDetectors();
  });

  afterEach(() => {
    clearAllDetectors();
  });

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
    clearAllDetectors();
    // Clear relevant env vars
    process.env.STUCK_NO_PROGRESS_MS = undefined;
    process.env.STUCK_MAX_TRANSITIONS = undefined;
    process.env.STUCK_SIMILARITY_THRESHOLD = undefined;
  });

  afterEach(() => {
    clearAllDetectors();
    // Restore original env
    process.env = { ...originalEnv };
  });

  it("returns hardcoded defaults when env vars not set", () => {
    const defaults = getStuckDetectionDefaults();
    expect(defaults.noProgressMs).toBe(120_000);
    expect(defaults.maxTransitions).toBe(200);
    expect(defaults.similarityThreshold).toBe(0.92);
  });

  it("reads noProgressMs from STUCK_NO_PROGRESS_MS env var", () => {
    process.env.STUCK_NO_PROGRESS_MS = "60000";
    const defaults = getStuckDetectionDefaults();
    expect(defaults.noProgressMs).toBe(60_000);
  });

  it("reads maxTransitions from STUCK_MAX_TRANSITIONS env var", () => {
    process.env.STUCK_MAX_TRANSITIONS = "100";
    const defaults = getStuckDetectionDefaults();
    expect(defaults.maxTransitions).toBe(100);
  });

  it("reads similarityThreshold from STUCK_SIMILARITY_THRESHOLD env var", () => {
    process.env.STUCK_SIMILARITY_THRESHOLD = "0.85";
    const defaults = getStuckDetectionDefaults();
    expect(defaults.similarityThreshold).toBe(0.85);
  });
});

describe("detectStuck with custom thresholds", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearAllDetectors();
  });

  afterEach(() => {
    clearAllDetectors();
    process.env = { ...originalEnv };
  });

  it("uses env var defaults when no options provided", () => {
    process.env.STUCK_NO_PROGRESS_MS = "60000"; // 60s instead of 120s

    const now = Date.now();
    const state = updateTracker(emptyState(), {
      type: "codex/thought",
      agentId: "agent-env" as AgentId,
      text: "thinking",
      ts: now,
    });

    // Should be stuck after 60s (env var threshold) but not 50s
    expect(detectStuck(state, "agent-env" as AgentId, now + 50_000)).toBe(false);
    expect(detectStuck(state, "agent-env" as AgentId, now + 70_000)).toBe(true);
  });

  it("explicit options override env var defaults", () => {
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
});

describe("clearAgentDetector", () => {
  beforeEach(() => {
    clearAllDetectors();
  });

  afterEach(() => {
    clearAllDetectors();
  });

  it("allows same content after clearing detector", () => {
    const thought = "repeated thought";
    let state = emptyState();

    // First occurrence
    state = updateTracker(state, {
      type: "codex/thought",
      agentId: "agent-clear" as AgentId,
      text: thought,
      ts: Date.now(),
    });
    expect(state.agents["agent-clear" as AgentId].status).toBe("running");

    // Second occurrence - should be stuck
    state = updateTracker(state, {
      type: "codex/thought",
      agentId: "agent-clear" as AgentId,
      text: thought,
      ts: Date.now() + 1,
    });
    expect(state.agents["agent-clear" as AgentId].status).toBe("stuck");

    // Clear detector
    clearAgentDetector("agent-clear" as AgentId);

    // Reset agent status manually for this test
    state.agents["agent-clear" as AgentId].status = "running";

    // Same content should not immediately trigger stuck after clear
    state = updateTracker(state, {
      type: "codex/thought",
      agentId: "agent-clear" as AgentId,
      text: thought,
      ts: Date.now() + 2,
    });
    expect(state.agents["agent-clear" as AgentId].status).toBe("running");
  });
});
