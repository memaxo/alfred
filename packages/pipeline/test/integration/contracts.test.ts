import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

mock.module("ai", () => ({
  generateObject: () => {
    throw new Error("mock_ai_disabled");
  },
  generateText: () => {
    throw new Error("mock_ai_disabled");
  },
}));

mock.module("@alfred/runtime/orchestrator/summary", () => ({
  generateWaveSummary: async () => "mock summary",
}));

const { PipelineRunner } = await import("../../src/runner");
const { createEvent } = await import("../../src/events");
const { registerDefaultStages } = await import("../../src/stages");

describe("Pipeline contracts", () => {
  const testWorkspace = join(
    process.cwd(),
    ".agent/test-workspaces/pipeline-contracts"
  );

  beforeAll(async () => {
    await mkdir(testWorkspace, { recursive: true });
  });

  afterAll(async () => {
    await rm(testWorkspace, { recursive: true, force: true });
  });

  it("stores PlanOutput with planId + structuredPlan", async () => {
    const events: any[] = [];
    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
    });
    registerDefaultStages(runner);
    runner.addObserver({ onEvent: (e) => events.push(e) });

    const runId = randomUUID();
    const input = {
      runId,
      requirement: "Create a simple hello.ts file",
      workspace: testWorkspace,
      userId: "test-user",
    };

    for await (const _event of runner.runUntilStage(input, "schedule")) {
      void _event;
    }

    const planOutputSet = events.find(
      (e) => e.type === "context:set" && e.key === "planOutput"
    );
    expect(planOutputSet).toBeDefined();
    expect(planOutputSet.value?.planId).toBeDefined();
    expect(planOutputSet.value?.structuredPlan).toBeDefined();
  }, 60_000);

  it("enforces maxTransitions safeguard", async () => {
    const runner = new PipelineRunner({ maxTransitions: 10 });
    runner.registerStage({
      name: "init",
      execute: (_input: unknown, ctx: any) => {
        for (let i = 0; i < 50; i++) {
          ctx.emit(
            createEvent("stage:progress", { stage: "init", message: String(i) })
          );
        }
        return Promise.resolve({ ok: true });
      },
    });

    const runId = randomUUID();
    const input = {
      runId,
      requirement: "Test max transitions",
      workspace: testWorkspace,
      userId: "test-user",
    };

    await expect(async () => {
      for await (const _event of runner.runUntilStage(input, "init")) {
        void _event;
      }
    }).toThrow(/pipeline_max_transitions_exceeded/);
  });
});
