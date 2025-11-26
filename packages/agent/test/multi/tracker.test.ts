import { describe, expect, it, spyOn } from "bun:test";
import type { AgentId } from "@alfred/agent/orchestrator/multi/spawn";
import type { TrackerState } from "@alfred/agent/orchestrator/multi/tracker";
import {
  __internals,
  detectNeedsGuidance,
  detectStuck,
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
