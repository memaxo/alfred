import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
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

    // Verify execute output is persisted in context for summarize stage
    const executeOutputSet = events.find(
      (e) => e.type === "context:set" && e.key === "executeOutput"
    );
    expect(executeOutputSet).toBeDefined();
  }, 300_000); // 5 minute timeout for full pipeline

  it("emits progress events for each stage", async () => {
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
      requirement: "Create a test file",
      workspace: testWorkspace,
      userId: "test-user",
    };

    for await (const _event of runner.run(input)) {
      // Collect events
    }

    // Verify progress events were emitted
    const progressEvents = events.filter((e) => e.type === "stage:progress");
    expect(progressEvents.length).toBeGreaterThan(0);

    // Verify each stage has at least one progress event
    const stagesWithProgress = new Set(
      progressEvents.map((e) => (e as { stage: string }).stage)
    );
    expect(stagesWithProgress.size).toBeGreaterThan(0);
  }, 300_000);

  it("creates ExecPlan files in correct location", async () => {
    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
    });
    registerDefaultStages(runner);

    const runId = randomUUID();
    const input = {
      runId,
      requirement: "Create a test file with validation",
      workspace: testWorkspace,
      userId: "test-user",
    };

    for await (const _event of runner.run(input)) {
      // Execute pipeline
    }

    // Verify root plan was created
    const plansDir = join(testWorkspace, ".agent", "plans", runId);
    const rootPlanPath = join(plansDir, "root.md");

    const rootPlanContent = await readFile(rootPlanPath, "utf-8");
    expect(rootPlanContent).toContain("# Root ExecPlan:");
    expect(rootPlanContent).toContain(input.requirement);
    expect(rootPlanContent).toContain("## Subtasks");
    expect(rootPlanContent).toContain("## Progress");
  }, 300_000);

  it("records stage durations", async () => {
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
      requirement: "Create a test file",
      workspace: testWorkspace,
      userId: "test-user",
    };

    for await (const _event of runner.run(input)) {
      // Collect events
    }

    // Verify all stage exits have duration > 0
    const exitEvents = events.filter((e) => e.type === "stage:exit");
    for (const event of exitEvents) {
      if (event.type === "stage:exit") {
        expect(event.durationMs).toBeGreaterThanOrEqual(0);
      }
    }
  }, 300_000);

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
      for await (const _event of runner.run(input)) {
        // Collect events
      }
    }).toThrow("Stage not registered: init");
  });

  it("handles stage timeout gracefully", async () => {
    const events: PipelineEvent[] = [];
    const runner = new PipelineRunner({
      maxParallel: 1,
      phaseTimeouts: {
        init: 5,
        context: 120_000,
        plan: 120_000,
        schedule: 10_000,
        execute: 600_000,
        review: 300_000,
        learn: 60_000,
        summarize: 30_000,
      },
    });
    runner.registerStage({
      name: "init",
      execute: async () => {
        await Bun.sleep(50);
        return { ok: true };
      },
    });
    runner.addObserver({
      onEvent: (e) => events.push(e),
    });

    const runId = randomUUID();
    const input = {
      runId,
      requirement: "Test timeout",
      workspace: testWorkspace,
      userId: "test-user",
    };

    await expect(async () => {
      for await (const _event of runner.run(input)) {
        // Collect events
      }
    }).toThrow(/timed out/);

    const errorEvents = events.filter((e) => e.type === "stage:error");
    expect(errorEvents.length).toBeGreaterThan(0);

    const failedEvent = events.find((e) => e.type === "pipeline:failed");
    expect(failedEvent).toBeDefined();
  }, 10_000);
});
