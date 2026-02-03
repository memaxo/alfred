import { describe, expect, it } from "bun:test";

import type { PipelineStage } from "../src/pipeline";
import type { PipelineSnapshot } from "../src/snapshot";

import { createEvent } from "../src/events";
import { PipelineRunner } from "../src/runner";
import { toSerializable } from "../src/snapshot";

describe("PipelineRunner", () => {
  it("creates events with timestamps", () => {
    const event = createEvent("stage:enter", { stage: "init" });

    expect(event.type).toBe("stage:enter");
    expect(event.stage).toBe("init");
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it("can resume until a stage boundary without replaying earlier stages", async () => {
    const runner = new PipelineRunner();

    const stageContext: PipelineStage<string, string> = {
      name: "context",
      execute: async (input) => {
        expect(input).toBe("init-out");
        return "context-out";
      },
    };

    runner.registerStage(stageContext);

    const snapshot: PipelineSnapshot = {
      contextEntries: [["initOutput", toSerializable("init-out")]],
      error: null,
      lastCompletedStage: "init",
      lastCompletedStageIndex: 0,
      lastEventAt: Date.now(),
      lastEventId: null,
      requirement: "test",
      runId: "run-1",
      stageResults: [{ name: "init", durationMs: 1, status: "success" }],
      startedAt: Date.now(),
      status: "suspended",
    };

    const input = {
      requirement: "test",
      runId: "run-1",
      userId: "u1",
      workspace: "/tmp",
    };

    const gen = runner.resumeUntilStage(snapshot, input, "context");
    const events: { type: string }[] = [];
    let out: unknown;
    while (true) {
      const step = await gen.next();
      if (step.done) {
        out = step.value;
        break;
      }
      events.push(step.value as { type: string });
    }

    expect(out).toBe("context-out");
    expect(events.some((e) => e.type === "pipeline:resume")).toBe(true);
    expect(events.some((e) => e.type === "stage:enter")).toBe(true);
    expect(events.some((e) => e.type === "stage:exit")).toBe(true);
    expect(events.some((e) => e.type === "pipeline:suspend")).toBeTruthy();
  });
});
