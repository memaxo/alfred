import { describe, expect, it } from "bun:test";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import type { WorkflowEvent } from "@alfred/type/plan";
import { hydrateTrackerContext } from "../src/orchestrator/waves";

const mockSubTasks: SubTask[] = [
  {
    id: "task-1",
    title: "Task 1",
    requirement: "Do something",
    deps: [],
    priority: 1,
    acceptance: [],
    filesHint: [],
  },
];

describe("Orchestrator Hydration", () => {
  it("marks completed waves from history as completed", () => {
    const history: WorkflowEvent[] = [
      {
        type: "event",
        kind: "wave-result",
        data: { waveId: "wave_0", status: "completed" },
      } as any,
    ];

    const trackerContext = hydrateTrackerContext(history, mockSubTasks);

    expect(trackerContext.state.waves.wave_0?.status).toBe("completed");
  });

  it("marks partial waves from history as failed (and therefore resumable)", () => {
    const history: WorkflowEvent[] = [
      {
        type: "event",
        kind: "wave-result",
        data: { waveId: "wave_0", status: "partial" },
      } as any,
    ];

    const trackerContext = hydrateTrackerContext(history, mockSubTasks);

    expect(trackerContext.state.waves.wave_0?.status).toBe("failed");
  });

  it("initializes dependency indices from subtasks", () => {
    const subTasks: SubTask[] = [
      {
        id: "task-a",
        title: "Task A",
        requirement: "First task",
        deps: [],
        priority: 1,
        acceptance: [],
        filesHint: [],
      },
      {
        id: "task-b",
        title: "Task B",
        requirement: "Second task",
        deps: ["task-a"],
        priority: 0.9,
        acceptance: [],
        filesHint: [],
      },
    ];

    const trackerContext = hydrateTrackerContext([], subTasks);

    expect(trackerContext.dependsOn.get("task-b")?.has("task-a")).toBe(true);
    expect(trackerContext.blockedBy.get("task-a")?.has("task-b")).toBe(true);
  });
});
