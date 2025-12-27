import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import type { AgentId } from "@alfred/agent/orchestrator/multi/spawn";
import {
  __internals,
  clearAgentDetectorWithContext,
  createTrackerContext,
  detectStuckWithContext,
  getStuckDetectionDefaults,
  type TrackerContext,
  updateTrackerWithContext,
} from "@alfred/agent/orchestrator/multi/tracker";

const emptySubTasks: SubTask[] = [];

function createEmptyContext(options?: {
  noProgressMs?: number;
}): TrackerContext {
  return createTrackerContext(emptySubTasks, options);
}

describe("tracker.updateTrackerWithContext", () => {
  it("initialises agent state on first event", () => {
    const now = Date.now();
    const ctx = createEmptyContext();
    const next = updateTrackerWithContext(ctx, {
      type: "codex/thought",
      agentId: "agent-1" as AgentId,
      text: "thinking",
      ts: now,
    });

    const agent = next.state.agents["agent-1" as AgentId];
    expect(agent).toBeDefined();
    expect(agent.status).toBe("running");
    expect(agent.lastEventTs).toBe(now);
  });

  it("records commands and status transitions", () => {
    let ctx = createEmptyContext();
    const ts1 = Date.now();
    const ts2 = ts1 + 1000;

    ctx = updateTrackerWithContext(ctx, {
      type: "codex/command",
      agentId: "agent-2" as AgentId,
      command: "bun test src/",
      status: "running",
      ts: ts1,
    });

    // Use a different command to avoid loop detection
    ctx = updateTrackerWithContext(ctx, {
      type: "codex/command",
      agentId: "agent-2" as AgentId,
      command: "bun test packages/",
      status: "completed",
      ts: ts2,
    });

    const agent = ctx.state.agents["agent-2" as AgentId];
    expect(agent.status).toBe("completed");
    expect(agent.lastEventTs).toBe(ts2);
  });

  it("tracks file changes via timestamps", () => {
    const ctx = createEmptyContext();
    const ts = Date.now();

    const next = updateTrackerWithContext(ctx, {
      type: "codex/file",
      agentId: "agent-3" as AgentId,
      path: "src/app.ts",
      kind: "file",
      ts,
    });

    const agent = next.state.agents["agent-3" as AgentId];
    expect(agent.lastEventTs).toBe(ts);
  });

  it("updates notice timestamps without altering original context", () => {
    const ctx = createEmptyContext();
    const next = updateTrackerWithContext(ctx, {
      type: "notice",
      agentId: "agent-4" as AgentId,
      message: "ping",
      ts: 123,
    });

    expect(next).not.toBe(ctx);
    expect(next.state.agents["agent-4" as AgentId]?.lastEventTs).toBe(123);
    expect(ctx.state.agents["agent-4" as AgentId]).toBeUndefined();
  });

  it("detects stuck status via LoopDetector on repeated commands", () => {
    let ctx = createEmptyContext();
    const baseTs = Date.now();

    // Send same command multiple times - should trigger exact_match
    for (let i = 0; i < 3; i++) {
      ctx = updateTrackerWithContext(ctx, {
        type: "codex/command",
        agentId: "agent-loop" as AgentId,
        command: "bun test",
        status: "running",
        ts: baseTs + i,
      });
    }

    const agent = ctx.state.agents["agent-loop" as AgentId];
    expect(agent.status).toBe("stuck");
  });
});

describe("tracker.detectStuckWithContext", () => {
  it("returns false for fresh agent activity", () => {
    const now = Date.now();
    let ctx = createEmptyContext();
    ctx = updateTrackerWithContext(ctx, {
      type: "codex/thought",
      agentId: "agent-4" as AgentId,
      text: "ok",
      ts: now,
    });

    expect(detectStuckWithContext(ctx, "agent-4" as AgentId, now + 1000)).toBe(
      false
    );
  });

  it("detects no-progress timeout", () => {
    const now = Date.now();
    let ctx = createTrackerContext(emptySubTasks, { noProgressMs: 120_000 });
    ctx = updateTrackerWithContext(ctx, {
      type: "codex/thought",
      agentId: "agent-5" as AgentId,
      text: "stalled",
      ts: now,
    });

    const stuck = detectStuckWithContext(
      ctx,
      "agent-5" as AgentId,
      now + 200_000
    );
    expect(stuck).toBe(true);
  });

  it("detects repeated thoughts via status", () => {
    let ctx = createEmptyContext();
    const baseTs = Date.now();

    // Same thought twice should mark as stuck
    ctx = updateTrackerWithContext(ctx, {
      type: "codex/thought",
      agentId: "agent-6" as AgentId,
      text: "checking the same thing",
      ts: baseTs,
    });
    ctx = updateTrackerWithContext(ctx, {
      type: "codex/thought",
      agentId: "agent-6" as AgentId,
      text: "checking the same thing",
      ts: baseTs + 1,
    });

    // Status should be stuck from the LoopDetector
    expect(ctx.state.agents["agent-6" as AgentId].status).toBe("stuck");
    expect(
      detectStuckWithContext(ctx, "agent-6" as AgentId, baseTs + 10_000)
    ).toBe(true);
  });

  it("allows varied content without marking stuck", () => {
    let ctx = createEmptyContext();
    const baseTs = Date.now();

    const thoughts = [
      "First analysis step",
      "Second evaluation phase",
      "Third implementation detail",
      "Fourth testing consideration",
      "Fifth deployment step",
    ];

    for (let i = 0; i < thoughts.length; i++) {
      ctx = updateTrackerWithContext(ctx, {
        type: "codex/thought",
        agentId: "agent-varied" as AgentId,
        text: thoughts[i],
        ts: baseTs + i * 1000,
      });
    }

    const agent = ctx.state.agents["agent-varied" as AgentId];
    expect(agent.status).toBe("running");
    expect(
      detectStuckWithContext(ctx, "agent-varied" as AgentId, baseTs + 10_000)
    ).toBe(false);
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
    const ctx = createEmptyContext();
    ensureAgent(ctx.state, "agent-10" as AgentId, "task" as any, 10);
    ensureAgent(ctx.state, "agent-10" as AgentId, "task" as any, 20);
    expect(ctx.state.agents["agent-10" as AgentId]?.lastEventTs).toBe(20);
  });
});

describe("getStuckDetectionDefaults", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars
    process.env.STUCK_NO_PROGRESS_MS = undefined;
    process.env.STUCK_MAX_TRANSITIONS = undefined;
    process.env.STUCK_SIMILARITY_THRESHOLD = undefined;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it("returns hardcoded defaults when env vars not set", () => {
    const defaults = getStuckDetectionDefaults();
    expect(defaults.noProgressMs).toBe(60_000);
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

describe("detectStuckWithContext with custom thresholds", () => {
  it("uses context options for timeout detection", () => {
    const now = Date.now();
    let ctx = createTrackerContext(emptySubTasks, { noProgressMs: 60_000 });
    ctx = updateTrackerWithContext(ctx, {
      type: "codex/thought",
      agentId: "agent-env" as AgentId,
      text: "thinking",
      ts: now,
    });

    // Should be stuck after 60s (context threshold) but not 50s
    expect(
      detectStuckWithContext(ctx, "agent-env" as AgentId, now + 50_000)
    ).toBe(false);
    expect(
      detectStuckWithContext(ctx, "agent-env" as AgentId, now + 70_000)
    ).toBe(true);
  });

  it("allows longer timeout for complex tasks", () => {
    const now = Date.now();
    let ctx = createTrackerContext(emptySubTasks, { noProgressMs: 300_000 });
    ctx = updateTrackerWithContext(ctx, {
      type: "codex/thought",
      agentId: "agent-complex" as AgentId,
      text: "complex analysis",
      ts: now,
    });

    // With longer timeout (5 minutes), should not be stuck after 3 minutes
    expect(
      detectStuckWithContext(ctx, "agent-complex" as AgentId, now + 180_000)
    ).toBe(false);

    // But should be stuck after 6 minutes
    expect(
      detectStuckWithContext(ctx, "agent-complex" as AgentId, now + 360_000)
    ).toBe(true);
  });
});

describe("clearAgentDetectorWithContext", () => {
  it("allows same content after clearing detector", () => {
    const thought = "repeated thought";
    let ctx = createEmptyContext();

    // First occurrence
    ctx = updateTrackerWithContext(ctx, {
      type: "codex/thought",
      agentId: "agent-clear" as AgentId,
      text: thought,
      ts: Date.now(),
    });
    expect(ctx.state.agents["agent-clear" as AgentId].status).toBe("running");

    // Second occurrence - should be stuck
    ctx = updateTrackerWithContext(ctx, {
      type: "codex/thought",
      agentId: "agent-clear" as AgentId,
      text: thought,
      ts: Date.now() + 1,
    });
    expect(ctx.state.agents["agent-clear" as AgentId].status).toBe("stuck");

    // Clear detector
    clearAgentDetectorWithContext(ctx, "agent-clear" as AgentId);

    // Reset agent status manually for this test
    ctx.state.agents["agent-clear" as AgentId].status = "running";

    // Same content should not immediately trigger stuck after clear
    ctx = updateTrackerWithContext(ctx, {
      type: "codex/thought",
      agentId: "agent-clear" as AgentId,
      text: thought,
      ts: Date.now() + 2,
    });
    expect(ctx.state.agents["agent-clear" as AgentId].status).toBe("running");
  });
});

describe("createTrackerContext", () => {
  it("initializes dependency indices from subtasks", () => {
    const subTasks: SubTask[] = [
      {
        id: "task-a",
        title: "Task A",
        requirement: "First task",
        deps: [],
        priority: 1,
        acceptance: [],
        filesHint: [],
      },
      {
        id: "task-b",
        title: "Task B",
        requirement: "Second task",
        deps: ["task-a"],
        priority: 0.9,
        acceptance: [],
        filesHint: [],
      },
      {
        id: "task-c",
        title: "Task C",
        requirement: "Third task",
        deps: ["task-a", "task-b"],
        priority: 0.8,
        acceptance: [],
        filesHint: [],
      },
    ];

    const ctx = createTrackerContext(subTasks);

    // Check dependsOn (forward dependencies)
    expect(ctx.dependsOn.get("task-a")?.size).toBe(0);
    expect(ctx.dependsOn.get("task-b")?.has("task-a")).toBe(true);
    expect(ctx.dependsOn.get("task-c")?.has("task-a")).toBe(true);
    expect(ctx.dependsOn.get("task-c")?.has("task-b")).toBe(true);

    // Check blockedBy (reverse dependencies)
    expect(ctx.blockedBy.get("task-a")?.has("task-b")).toBe(true);
    expect(ctx.blockedBy.get("task-a")?.has("task-c")).toBe(true);
    expect(ctx.blockedBy.get("task-b")?.has("task-c")).toBe(true);
  });

  it("uses custom stuck detection options", () => {
    const ctx = createTrackerContext([], {
      noProgressMs: 60_000,
      maxTransitions: 100,
      similarityThreshold: 0.85,
    });

    expect(ctx.options.noProgressMs).toBe(60_000);
    expect(ctx.options.maxTransitions).toBe(100);
    expect(ctx.options.similarityThreshold).toBe(0.85);
  });
});
