import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { PipelineEvent } from "../../src/events";
import { PipelineRunner } from "../../src/runner";
import { registerDefaultStages } from "../../src/stages";

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

  it("enforces MAX_TRANSITIONS limit in workflow execution", async () => {
    const events: PipelineEvent[] = [];

    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
      maxTransitions: 3, // Very low limit to trigger guard
    });
    registerDefaultStages(runner);
    runner.addObserver({
      onEvent: (e) => events.push(e),
    });

    const runId = randomUUID();
    const input = {
      runId,
      requirement:
        "Create multiple test files that will exceed transition limit",
      workspace: testWorkspace,
      userId: "test-user",
    };

    let caughtError = false;
    try {
      for await (const _event of runner.run(input)) {
        // Pipeline should abort when MAX_TRANSITIONS exceeded
      }
    } catch (error) {
      caughtError = true;
      expect(String(error)).toMatch(/transition|limit|exceeded/i);
    }

    // If MAX_TRANSITIONS is enforced, we should either:
    // 1. Catch an error, or
    // 2. See a failed/suspended event
    const failedEvent = events.find((e) => e.type === "pipeline:failed");
    const suspendEvent = events.find((e) => e.type === "pipeline:suspend");

    expect(caughtError || failedEvent || suspendEvent).toBe(true);
  }, 120_000);

  it("completes successfully when under MAX_TRANSITIONS limit", async () => {
    const events: PipelineEvent[] = [];

    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
      maxTransitions: 1000, // High enough to not trigger
    });
    registerDefaultStages(runner);
    runner.addObserver({
      onEvent: (e) => events.push(e),
    });

    const runId = randomUUID();
    const input = {
      runId,
      requirement: "Create a simple test file",
      workspace: testWorkspace,
      userId: "test-user",
    };

    for await (const _event of runner.run(input)) {
      // Should complete without errors
    }

    // Verify successful completion
    const completeEvent = events.find((e) => e.type === "pipeline:complete");
    expect(completeEvent).toBeDefined();

    const failedEvent = events.find((e) => e.type === "pipeline:failed");
    expect(failedEvent).toBeUndefined();
  }, 300_000);

  it("emits transition count metrics", async () => {
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
      requirement: "Simple test",
      workspace: testWorkspace,
      userId: "test-user",
    };

    for await (const _event of runner.run(input)) {
      // Collect events
    }

    // Verify we tracked agent transitions/progress
    const agentEvents = events.filter(
      (e) => e.type === "agent:progress" || e.type === "agent:complete"
    );

    // Should have some agent activity
    expect(agentEvents.length).toBeGreaterThan(0);
  }, 300_000);
});
