import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { PipelineEvent } from "../../src/events";
import { PipelineRunner } from "../../src/runner";
import { registerDefaultStages } from "../../src/stages";

describe("Abort Signal Propagation", () => {
  const testWorkspace = join(
    process.cwd(),
    ".agent/test-workspaces/pipeline-abort-test"
  );

  beforeAll(async () => {
    await mkdir(testWorkspace, { recursive: true });
  });

  afterAll(async () => {
    await rm(testWorkspace, { recursive: true, force: true });
  });

  it("aborts pipeline when signal is triggered", async () => {
    const events: PipelineEvent[] = [];
    const controller = new AbortController();

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

    // Start pipeline and abort after init stage
    const runPromise = (async () => {
      const results: PipelineEvent[] = [];
      for await (const event of runner.run(input, controller.signal)) {
        results.push(event);

        // Abort after init stage completes
        if (
          event.type === "stage:exit" &&
          "stage" in event &&
          event.stage === "init"
        ) {
          controller.abort();
        }
      }
      return results;
    })();

    await expect(runPromise).rejects.toThrow("abort");

    // Verify init stage completed but pipeline aborted
    const stageExits = events.filter((e) => e.type === "stage:exit");
    expect(stageExits.length).toBeGreaterThanOrEqual(1);
    expect(stageExits.length).toBeLessThan(8); // Not all stages completed

    const failedEvent = events.find((e) => e.type === "pipeline:failed");
    expect(failedEvent).toBeDefined();
  }, 60_000);

  it("propagates abort to all active stages", async () => {
    const events: PipelineEvent[] = [];
    const controller = new AbortController();

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
      requirement: "Create test files",
      workspace: testWorkspace,
      userId: "test-user",
    };

    // Abort immediately
    controller.abort();

    const runPromise = (async () => {
      const results: PipelineEvent[] = [];
      for await (const event of runner.run(input, controller.signal)) {
        results.push(event);
      }
      return results;
    })();

    await expect(runPromise).rejects.toThrow("abort");

    // Verify pipeline failed immediately
    const stageEnters = events.filter((e) => e.type === "stage:enter");
    expect(stageEnters.length).toBe(0); // No stages even started
  }, 30_000);

  it("cleanup happens even when aborted", async () => {
    const events: PipelineEvent[] = [];
    const controller = new AbortController();

    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
    });
    registerDefaultStages(runner);

    let cleanupCalled = false;
    runner.addObserver({
      onEvent: (e) => events.push(e),
      onComplete: () => {
        cleanupCalled = true;
      },
    });

    const runId = randomUUID();
    const input = {
      runId,
      requirement: "Create test files",
      workspace: testWorkspace,
      userId: "test-user",
    };

    const runPromise = (async () => {
      for await (const event of runner.run(input, controller.signal)) {
        if (
          event.type === "stage:exit" &&
          "stage" in event &&
          event.stage === "context"
        ) {
          controller.abort();
        }
      }
    })();

    await expect(runPromise).rejects.toThrow();

    // Verify cleanup was called
    expect(cleanupCalled).toBe(true);
  }, 60_000);
});
