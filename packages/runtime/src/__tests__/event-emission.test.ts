import { describe, expect, it, mock } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StructuredPlan } from "@alfred/plan";
import type { OrchestratorContext } from "../orchestrator/types.js";
import { runWaves } from "../orchestrator/waves.js";

// Mock dependencies
mock.module("../orchestrator/agent.js", () => ({
  runAgent: async () => ({
    agentId: "agent-1",
    status: "completed",
    stuck: false,
    durationSeconds: 1,
    role: "codex",
  }),
}));

mock.module("../context.js", () => ({
  ContextBuilder: class {
    build() {
      return Promise.resolve({ bundle: { files: [] } });
    }
  },
}));

describe("Workflow Event Emission", () => {
  const mockPlan: StructuredPlan = {
    id: "plan-123",
    title: "Test Plan",
    intent: "Test Intent",
    phases: [
      {
        id: "phase-1",
        name: "Phase 1",
        description: "Desc 1",
        tasks: [
          {
            id: "T1",
            title: "Task 1",
            requirement: "Req 1",
            deps: [],
            priority: 1,
            acceptance: [],
            filesHint: [],
          },
        ],
        dependsOn: [],
        estimatedDurationMs: 1000,
        agentType: "codex",
      },
    ],
    resources: {
      agentCount: 1,
      strategy: "parallel",
      isolation: "container",
    },
    evaluationCriteria: [],
  };

  const tmpWorkspace = mkdtempSync(join(tmpdir(), "alfred-test-"));

  const mockCtx: OrchestratorContext = {
    input: {
      requirement: "Test Intent",
      auto: "low",
    },
    runId: "run-123",
    signal: new AbortController().signal,
    workspace: tmpWorkspace,
    plan: mockPlan,
  };

  it("should emit plan-selected, phase-start, wave-start, and agent-start events", async () => {
    const events: any[] = [];
    const generator = runWaves(mockCtx);

    for await (const event of generator) {
      events.push(event);
    }

    expect(events.some((e) => e._ === "plan-selected")).toBe(true);
    expect(
      events.some((e) => e._ === "phase-start" && e.phaseId === "phase-1")
    ).toBe(true);
    expect(events.some((e) => e._ === "wave-start")).toBe(true);
    expect(events.some((e) => e._ === "agent-start")).toBe(true);
    expect(events.some((e) => e._ === "agent-complete")).toBe(true);
    expect(
      events.some((e) => e._ === "phase-progress" && e.progress === 1.0)
    ).toBe(true);
    expect(events.some((e) => e._ === "wave-complete")).toBe(true);
    expect(events.some((e) => e._ === "phase-complete")).toBe(true);
  });
});
