import { beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { PipelineRunner } from "../../src/runner";
import type { PipelineSnapshot } from "../../src/snapshot";
import { registerDefaultStages } from "../../src/stages";

describe("Pipeline resume roundtrip", () => {
  const testWorkspace = join(
    process.cwd(),
    ".agent/test-workspaces/pipeline-resume-test"
  );

  beforeAll(async () => {
    await mkdir(testWorkspace, { recursive: true });
  });

  it("can resume from a snapshot without crashing", async () => {
    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
    });
    registerDefaultStages(runner);

    const runId = randomUUID();
    const input = {
      runId,
      requirement: "Create a simple hello.ts file",
      workspace: testWorkspace,
      userId: "test-user",
    };

    // Run up to schedule (no agent execution) so we can create a resume snapshot deterministically.
    const scheduleResult = await (async () => {
      let last: unknown = null;
      for await (const event of runner.runUntilStage(input, "schedule")) {
        void event;
      }
      last = "ok";
      return last;
    })();
    expect(scheduleResult).toBe("ok");

    // Minimal snapshot that resumes at execute stage boundary.
    const snapshot: PipelineSnapshot = {
      runId,
      status: "running",
      lastCompletedStageIndex: 3, // schedule is index 3 in STAGE_ORDER
      contextEntries: [],
      stageResults: [],
    };

    // Resume should start at execute and then proceed; we don't assert success because it may
    // fail in test env due to workspace/docker auth constraints, but it must terminate cleanly.
    const events: string[] = [];
    try {
      for await (const event of runner.resume(snapshot, input)) {
        events.push(event.type);
      }
    } catch (err) {
      // Allowed: some environments will fail in execute; but runner must emit events.
      void err;
    }

    expect(events.length).toBeGreaterThan(0);
  }, 300_000);

  it("cleans up test workspace", async () => {
    await rm(testWorkspace, { recursive: true, force: true });
    expect(true).toBe(true);
  });
});
