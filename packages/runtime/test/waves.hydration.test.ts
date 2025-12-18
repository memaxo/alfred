import { describe, expect, it } from "bun:test";
import type { WorkflowEvent } from "@alfred/type/plan";
import { hydrateTrackerState } from "../src/orchestrator/waves";

describe("Orchestrator Hydration", () => {
  it("marks completed waves from history as completed", () => {
    const history: WorkflowEvent[] = [
      {
        type: "event",
        kind: "wave-result",
        data: { waveId: "wave_0", status: "completed" },
      } as any,
    ];

    const trackerState = hydrateTrackerState(history);

    expect(trackerState.waves.wave_0?.status).toBe("completed");
  });

  it("marks partial waves from history as failed (and therefore resumable)", () => {
    const history: WorkflowEvent[] = [
      {
        type: "event",
        kind: "wave-result",
        data: { waveId: "wave_0", status: "partial" },
      } as any,
    ];

    const trackerState = hydrateTrackerState(history);

    expect(trackerState.waves.wave_0?.status).toBe("failed");
  });
});
