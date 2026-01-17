import { afterEach, describe, expect, it } from "bun:test";
import { clearRunCosts, getTrackedRuns, recordCost } from "@alfred/metrics";
import { PipelineRunner } from "../src/runner";

describe("Cost cleanup on pipeline termination", () => {
  afterEach(() => {
    for (const runId of getTrackedRuns()) {
      clearRunCosts(runId);
    }
  });

  it("clears tracked costs after pipeline run completes", async () => {
    const runner = new PipelineRunner({
      maxParallel: 1,
      enableLearning: false,
    });

    runner
      .registerStage({
        name: "init",
        execute: async () => ({ ok: true }),
      })
      .registerStage({
        name: "context",
        execute: async () => ({ ok: true }),
      })
      .registerStage({
        name: "plan",
        execute: async () => ({ ok: true }),
      })
      .registerStage({
        name: "schedule",
        execute: async () => ({ ok: true }),
      })
      .registerStage({
        name: "execute",
        execute: async (_input, ctx) => {
          recordCost("openai", "gpt-4o-mini", 0, 10_000, ctx.runId);
          return { ok: true, fileChanges: [] };
        },
      })
      .registerStage({
        name: "review",
        execute: async () => ({ ok: true }),
      })
      .registerStage({
        name: "learn",
        execute: async () => ({ ok: true }),
      })
      .registerStage({
        name: "summarize",
        execute: async () => ({ ok: true }),
      });

    const input = {
      runId: "budget-cleanup",
      requirement: "cleanup",
      workspace: "/tmp",
      userId: "user-1",
    };

    for await (const _event of runner.run(input)) {
      // Drain events
    }

    expect(getTrackedRuns().includes(input.runId)).toBe(false);
  });
});
