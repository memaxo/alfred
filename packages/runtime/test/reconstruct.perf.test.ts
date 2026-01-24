import type { WorkflowEvent } from "@alfred/type/plan";

import { benchmarkOperation } from "@alfred/test-kit";
import { describe, expect, it } from "bun:test";

import { WorkflowReconstructor } from "../src/workflow/reconstruct";

// budget: state-reconstruction

describe("Workflow State Reconstruction Performance", () => {
  const reconstructor = new WorkflowReconstructor();

  it("should reconstruct state from 10,000 events within budget", async () => {
    const eventCount = 10_000;
    const events: WorkflowEvent[] = [];

    // Generate 10k mock events
    for (let i = 0; i < eventCount; i++) {
      if (i % 100 === 0) {
        events.push({
          _: "phase-start",
          phaseId: `phase-${i}`,
          phase: {},
          runId: "test-run",
          eventId: `event-${i}`,
          createdAt: new Date().toISOString(),
        } as WorkflowEvent);
      } else if (i % 100 === 50) {
        events.push({
          _: "phase-complete",
          phaseId: `phase-${i - 50}`,
          result: {},
          runId: "test-run",
          eventId: `event-${i}`,
          createdAt: new Date().toISOString(),
        } as WorkflowEvent);
      } else {
        events.push({
          _: "progress",
          pct: i % 100,
          message: "working",
          runId: "test-run",
          eventId: `event-${i}`,
          createdAt: new Date().toISOString(),
        } as WorkflowEvent);
      }
    }

    const stats = await benchmarkOperation(
      "state-reconstruction",
      100, // 100ms budget
      5, // 5 iterations for stability
      async () => reconstructor.reconstruct(events)
    );

    console.log(
      `Reconstructed 10k events in avg ${stats.avg.toFixed(2)}ms (p99: ${stats.p99.toFixed(2)}ms)`
    );
    expect(stats.avg).toBeLessThan(100);
  });
});
