import { afterAll, describe, expect, it, mock } from "bun:test";
import type { WorkflowEvent } from "@alfred/type/plan";
import { ContextBuilder } from "../src/context";
import { runWaves } from "../src/orchestrator/waves";

const originalContextBuild = ContextBuilder.prototype.build;
ContextBuilder.prototype.build = async () => ({ bundle: {} }) as any;

mock.module("@alfred/agent/orchestrator/multi/decompose", () => ({
  decomposeTask: () => [
    {
      id: "task1",
      requirement: "task1 req",
      acceptance: [],
      filesHint: [],
      title: "Task 1",
    },
    {
      id: "task2",
      requirement: "task2 req",
      acceptance: [],
      filesHint: [],
      title: "Task 2",
    },
  ],
}));

mock.module("@alfred/agent/orchestrator/multi/spawn", () => ({
  planWaves: () => [
    { id: "wave_0", agents: ["task1"], dependsOn: [] },
    { id: "wave_1", agents: ["task2"], dependsOn: ["wave_0"] },
  ],
  buildAgentSpec: (task: any) => ({
    agentId: `agent-${task.id}`,
    subTaskId: task.id,
    execPlanPath: "/tmp/execplan.md",
    workingDirectory: "/tmp",
    environment: "host",
    auto: "low",
    model: "gpt-4",
    context: {},
  }),
}));

mock.module("@alfred/agent/environment/factory", () => ({
  WorkspaceFactory: {
    create: async () => ({
      initialize: async () => {},
      cleanup: async () => {},
      checkpoint: async () => {},
      restore: async () => {},
      root: "/tmp",
    }),
  },
}));

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: {
    execute: async () => ({}),
  },
}));

// Mock FS to avoid real file operations
mock.module("node:fs/promises", () => ({
  mkdir: async () => {},
  access: async () => {},
  writeFile: async () => {},
  readFile: async () => "",
}));

describe("Orchestrator Hydration", () => {
  it("skips completed waves from history", async () => {
    const history: WorkflowEvent[] = [
      {
        type: "event",
        kind: "wave-result",
        data: { waveId: "wave_0", status: "completed" },
      } as any,
    ];

    const generator = runWaves({
      input: { requirement: "test", auto: "low" },
      runId: "test-run",
      signal: new AbortController().signal,
      workspace: "/tmp",
      history,
      authz: "Bearer test",
    } as any);

    const events: any[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Should skip wave_0
    const skipEvent = events.find(
      (e) =>
        e.type === "notice" &&
        e.message === "wave_wave_0_skipped_already_completed"
    );
    expect(skipEvent).toBeDefined();

    // Should run wave_1
    const startEvent = events.find(
      (e) => e.type === "notice" && e.message === "wave_wave_1_start"
    );
    expect(startEvent).toBeDefined();
  });

  it("resumes failed waves from history (does NOT skip)", async () => {
    const history: WorkflowEvent[] = [
      {
        type: "event",
        kind: "wave-result",
        data: { waveId: "wave_0", status: "partial" }, // partial = failed
      } as any,
    ];

    const generator = runWaves({
      input: { requirement: "test", auto: "low" },
      runId: "test-run",
      signal: new AbortController().signal,
      workspace: "/tmp",
      history,
      authz: "Bearer test",
    } as any);

    const events: any[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Should NOT skip wave_0
    const skipEvent = events.find(
      (e) =>
        e.type === "notice" &&
        e.message === "wave_wave_0_skipped_already_completed"
    );
    expect(skipEvent).toBeUndefined();

    // Should start wave_0 again
    const startEvent = events.find(
      (e) => e.type === "notice" && e.message === "wave_wave_0_start"
    );
    expect(startEvent).toBeDefined();
  });

  afterAll(() => {
    ContextBuilder.prototype.build = originalContextBuild;
    mock.restore();
  });
});
