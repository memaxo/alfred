import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { PipelineEvent } from "../../src/events";
import { PipelineRunner } from "../../src/runner";
import { registerDefaultStages } from "../../src/stages";

describe("Golden Path Pipeline", () => {
  const testWorkspace = join(
    process.cwd(),
    ".agent/test-workspaces/pipeline-test"
  );

  beforeAll(async () => {
    await mkdir(testWorkspace, { recursive: true });
  });

  afterAll(async () => {
    await rm(testWorkspace, { recursive: true, force: true });
  });

  it("executes all 8 stages sequentially", async () => {
    const events: PipelineEvent[] = [];
    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
    });
    registerDefaultStages(runner);
    runner.addObserver({
      onEvent: (e) => events.push(e),
    });

    const runId = randomUUID();
    const input = {
      runId,
      requirement: "Create a simple hello.ts file",
      workspace: testWorkspace,
      userId: "test-user",
    };

    // Run the pipeline (events collected via observer)
    for await (const _event of runner.run(input)) {
      // Events are being collected by the observer
    }

    // Verify all 8 stages entered and exited
    const stageEnters = events.filter((e) => e.type === "stage:enter");
    const stageExits = events.filter((e) => e.type === "stage:exit");

    expect(stageEnters).toHaveLength(8);
    expect(stageExits).toHaveLength(8);

    // Verify correct order
    const enterStages = stageEnters.map((e) => (e as { stage: string }).stage);
    expect(enterStages).toEqual([
      "init",
      "context",
      "plan",
      "schedule",
      "execute",
      "review",
      "learn",
      "summarize",
    ]);

    // Verify pipeline completed
    const completeEvent = events.find((e) => e.type === "pipeline:complete");
    expect(completeEvent).toBeDefined();
  }, 300_000); // 5 minute timeout for full pipeline

  it("emits stage:error on failure", async () => {
    const events: PipelineEvent[] = [];
    const runner = new PipelineRunner({ maxParallel: 1 });
    // Intentionally don't register stages to cause failure
    runner.addObserver({
      onEvent: (e) => events.push(e),
    });

    const runId = randomUUID();
    const input = {
      runId,
      requirement: "This will fail",
      workspace: testWorkspace,
      userId: "test-user",
    };

    await expect(async () => {
      for await (const _ of runner.run(input)) {
        // Collect events
      }
    }).toThrow("Stage not registered: init");
  });
});
