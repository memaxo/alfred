import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import type { PipelineEvent } from "../../src/events";
import type { PipelineContext } from "../../src/pipeline";

import { PipelineRunner } from "../../src/runner";

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

  function createBlockingInitStage() {
    return {
      name: "init" as const,
      execute: async (_input: unknown, ctx: PipelineContext) =>
        new Promise<void>((_, reject) => {
          if (ctx.signal.aborted) {
            reject(new Error("pipeline_aborted"));
            return;
          }
          const onAbort = () => {
            ctx.signal.removeEventListener("abort", onAbort);
            reject(new Error("pipeline_aborted"));
          };
          ctx.signal.addEventListener("abort", onAbort);
        }),
    };
  }

  it("aborts before pipeline starts when signal is already aborted", async () => {
    const events: PipelineEvent[] = [];
    let cleanupCalled = false;
    const controller = new AbortController();
    controller.abort();

    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
    });
    runner.registerStage(createBlockingInitStage());
    runner.addObserver({
      onEvent: (e) => events.push(e),
      onComplete: () => {
        cleanupCalled = true;
      },
    });

    const input = {
      runId: randomUUID(),
      requirement: "Abort before start",
      workspace: testWorkspace,
      userId: "test-user",
    };

    await expect(async () => {
      for await (const _event of runner.run(input, controller.signal)) {
        // Drain events
      }
    }).toThrow(/aborted/);

    expect(events.filter((e) => e.type === "stage:enter")).toHaveLength(0);
    expect(events.find((e) => e.type === "pipeline:failed")).toBeDefined();
    expect(cleanupCalled).toBe(true);
  }, 30_000);

  it("aborts during a running stage and still calls cleanup", async () => {
    const events: PipelineEvent[] = [];
    let cleanupCalled = false;
    const controller = new AbortController();

    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
    });
    runner.registerStage(createBlockingInitStage());
    runner.addObserver({
      onEvent: (e) => events.push(e),
      onComplete: () => {
        cleanupCalled = true;
      },
    });

    const input = {
      runId: randomUUID(),
      requirement: "Abort mid-run",
      workspace: testWorkspace,
      userId: "test-user",
    };

    await expect(async () => {
      for await (const event of runner.run(input, controller.signal)) {
        if (event.type === "stage:enter") {
          controller.abort();
        }
      }
    }).toThrow(/aborted/);

    expect(events.find((e) => e.type === "pipeline:failed")).toBeDefined();
    expect(cleanupCalled).toBe(true);
  }, 30_000);
});
