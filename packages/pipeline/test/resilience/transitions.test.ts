import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { PipelineEvent } from "../../src/events";
import type { PipelineContext, StageName } from "../../src/pipeline";
import { PipelineRunner } from "../../src/runner";

describe("MAX_TRANSITIONS Guard", () => {
  const testWorkspace = join(
    process.cwd(),
    ".agent/test-workspaces/pipeline-transitions-test"
  );

  beforeAll(async () => {
    await mkdir(testWorkspace, { recursive: true });
  });

  afterAll(async () => {
    await rm(testWorkspace, { recursive: true, force: true });
  });

  function createMockStage(name: StageName, emitCount = 0) {
    return {
      name,
      execute: (_input: unknown, ctx: PipelineContext) => {
        for (let i = 0; i < emitCount; i++) {
          ctx.emit({
            type: "stage:progress",
            stage: name,
            message: `tick-${i}`,
            timestamp: Date.now(),
          });
        }
        return { ok: true };
      },
    };
  }

  function registerAllMockStages(runner: PipelineRunner): void {
    runner
      .registerStage(createMockStage("init"))
      .registerStage(createMockStage("context"))
      .registerStage(createMockStage("plan"))
      .registerStage(createMockStage("schedule"))
      .registerStage(createMockStage("execute"))
      .registerStage(createMockStage("review"))
      .registerStage(createMockStage("learn"))
      .registerStage(createMockStage("summarize"));
  }

  it("enforces maxTransitions limit when events exceed the guard", async () => {
    const events: PipelineEvent[] = [];

    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
      maxTransitions: 5,
    });
    runner.registerStage(createMockStage("init", 10));
    runner.addObserver({
      onEvent: (e) => events.push(e),
    });

    const input = {
      runId: randomUUID(),
      requirement: "Trigger transitions limit",
      workspace: testWorkspace,
      userId: "test-user",
    };

    await expect(async () => {
      for await (const _event of runner.run(input)) {
        // Drain events
      }
    }).toThrow(/max_transitions_exceeded/);

    const failed = events.find((e) => e.type === "pipeline:failed");
    expect(failed).toBeDefined();
    if (failed && failed.type === "pipeline:failed") {
      expect(failed.error).toContain("pipeline_max_transitions_exceeded");
      expect(typeof failed.lastStage).toBe("string");
    }
  }, 30_000);

  it("completes successfully when under maxTransitions limit", async () => {
    const events: PipelineEvent[] = [];

    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
      maxTransitions: 1000,
    });
    registerAllMockStages(runner);
    runner.addObserver({
      onEvent: (e) => events.push(e),
    });

    const input = {
      runId: randomUUID(),
      requirement: "Complete under limit",
      workspace: testWorkspace,
      userId: "test-user",
    };

    for await (const _event of runner.run(input)) {
      // Drain events
    }

    expect(events.find((e) => e.type === "pipeline:complete")).toBeDefined();
    expect(events.find((e) => e.type === "pipeline:failed")).toBeUndefined();
  }, 30_000);
});
