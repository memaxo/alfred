/**
 * Unit tests for upstream failure propagation.
 *
 * Tests propagateUpstreamFailures, collectToolsToAvoid, and related helpers.
 */

import { type FailureContext } from "@alfred/type";
import { type SubTask } from "@alfred/type/plan";
import { describe, expect, it } from "bun:test";

import {
  collectToolsToAvoid,
  getUpstreamFailureSummary,
  propagateUpstreamFailures,
} from "../enrich/propagate.js";

// Test fixtures
function createSubTask(overrides: Partial<SubTask> = {}): SubTask {
  return {
    id: "task-1",
    requirement: "Test task",
    deps: [],
    ...overrides,
  };
}

function createFailureContext(
  overrides: Partial<FailureContext> = {}
): FailureContext {
  return {
    taskId: "task-1",
    runId: "run-123",
    status: "failure",
    toolErrors: [],
    loopDetections: [],
    escalations: [],
    reviewFailures: [],
    durationMs: 5000,
    ts: Date.now(),
    ...overrides,
  };
}

describe("Upstream Failure Propagation", () => {
  describe("collectToolsToAvoid", () => {
    it("should collect tools from failure contexts", () => {
      const failures = new Map<string, FailureContext>([
        [
          "task-1",
          createFailureContext({
            taskId: "task-1",
            toolErrors: [
              {
                count: 3,
                error: "Error",
                lastOccurrence: Date.now(),
                tool: "shell",
              },
              {
                count: 2,
                error: "Error",
                lastOccurrence: Date.now(),
                tool: "rm",
              },
            ],
          }),
        ],
        [
          "task-2",
          createFailureContext({
            taskId: "task-2",
            toolErrors: [
              {
                count: 5,
                error: "Error",
                lastOccurrence: Date.now(),
                tool: "write",
              },
              {
                count: 4,
                error: "Error",
                lastOccurrence: Date.now(),
                tool: "shell",
              },
            ],
          }),
        ],
      ]);

      const tools = collectToolsToAvoid(failures);

      expect(tools.has("shell")).toBe(true);
      expect(tools.has("rm")).toBe(true);
      expect(tools.has("write")).toBe(true);
    });

    it("should respect minFailureCount parameter", () => {
      const failures = new Map<string, FailureContext>([
        [
          "task-1",
          createFailureContext({
            taskId: "task-1",
            toolErrors: [
              {
                count: 5,
                error: "Error",
                lastOccurrence: Date.now(),
                tool: "shell",
              },
              {
                count: 1,
                error: "Error",
                lastOccurrence: Date.now(),
                tool: "read",
              },
            ],
          }),
        ],
      ]);

      const toolsDefault = collectToolsToAvoid(failures);
      expect(toolsDefault.has("shell")).toBe(true);
      expect(toolsDefault.has("read")).toBe(false); // count < 2

      const toolsHigher = collectToolsToAvoid(failures, 4);
      expect(toolsHigher.has("shell")).toBe(true);
      expect(toolsHigher.has("read")).toBe(false);
    });

    it("should return empty map for empty input", () => {
      const failures = new Map<string, FailureContext>();
      const tools = collectToolsToAvoid(failures);
      expect(tools.size).toBe(0);
    });
  });

  describe("getUpstreamFailureSummary", () => {
    it("should generate summary for tasks with failed dependencies", () => {
      const tasks: SubTask[] = [
        createSubTask({ deps: [], id: "task-1" }),
        createSubTask({ deps: ["task-1"], id: "task-2" }),
      ];

      const failures = new Map<string, FailureContext>([
        [
          "task-1",
          createFailureContext({
            status: "failure",
            taskId: "task-1",
          }),
        ],
      ]);

      const summary = getUpstreamFailureSummary("task-2", tasks, failures);

      expect(summary).toContain("Upstream failures");
      expect(summary).toContain("task-1");
      expect(summary).toContain("failure");
    });

    it("should include stuck reason in summary", () => {
      const tasks: SubTask[] = [
        createSubTask({ deps: [], id: "task-1" }),
        createSubTask({ deps: ["task-1"], id: "task-2" }),
      ];

      const failures = new Map<string, FailureContext>([
        [
          "task-1",
          createFailureContext({
            status: "stuck",
            stuckReason: "Agent in loop",
            taskId: "task-1",
          }),
        ],
      ]);

      const summary = getUpstreamFailureSummary("task-2", tasks, failures);

      expect(summary).toContain("Agent in loop");
    });

    it("should return empty string for task with no failed deps", () => {
      const tasks: SubTask[] = [
        createSubTask({ deps: [], id: "task-1" }),
        createSubTask({ deps: ["task-1"], id: "task-2" }),
      ];

      const failures = new Map<string, FailureContext>();

      const summary = getUpstreamFailureSummary("task-2", tasks, failures);

      expect(summary).toBe("");
    });

    it("should return empty string for non-existent task", () => {
      const tasks: SubTask[] = [];
      const failures = new Map<string, FailureContext>();

      const summary = getUpstreamFailureSummary(
        "non-existent",
        tasks,
        failures
      );

      expect(summary).toBe("");
    });
  });

  describe("propagateUpstreamFailures", () => {
    it("should add upstream failures to tasks with failed dependencies", () => {
      const tasks: SubTask[] = [
        createSubTask({ deps: [], id: "task-1" }),
        createSubTask({ deps: ["task-1"], id: "task-2" }),
      ];

      const failures = new Map<string, FailureContext>([
        [
          "task-1",
          createFailureContext({
            taskId: "task-1",
            toolErrors: [
              {
                count: 3,
                error: "Error",
                lastOccurrence: Date.now(),
                tool: "shell",
              },
            ],
          }),
        ],
      ]);

      const propagated = propagateUpstreamFailures(tasks, failures);

      // task-1 should be unchanged (no deps)
      expect(propagated[0].metadata?.upstreamFailures).toBeUndefined();
      // task-2 should have upstream failure from task-1
      expect(propagated[1].metadata?.upstreamFailures).toBeDefined();
      expect(propagated[1].metadata?.upstreamFailures).toHaveLength(1);
    });

    it("should include transitive failures when enabled", () => {
      const tasks: SubTask[] = [
        createSubTask({ deps: [], id: "task-1" }),
        createSubTask({ deps: ["task-1"], id: "task-2" }),
        createSubTask({ deps: ["task-1", "task-2"], id: "task-3" }), // task-3 depends directly on both
      ];

      const failures = new Map<string, FailureContext>([
        ["task-1", createFailureContext({ taskId: "task-1" })],
      ]);

      const propagated = propagateUpstreamFailures(tasks, failures, {
        includeTransitive: true,
      });

      // task-2 should have upstream failure from task-1
      expect(propagated[1].metadata?.upstreamFailures).toBeDefined();
      // task-3 should also know about task-1's failure (direct dependency)
      expect(propagated[2].metadata?.upstreamFailures).toBeDefined();
    });

    it("should return tasks unchanged when no failures", () => {
      const tasks: SubTask[] = [
        createSubTask({ deps: [], id: "task-1" }),
        createSubTask({ deps: ["task-1"], id: "task-2" }),
      ];

      const failures = new Map<string, FailureContext>();

      const propagated = propagateUpstreamFailures(tasks, failures);

      expect(propagated).toEqual(tasks);
    });

    it("should handle tasks with no dependencies", () => {
      const tasks: SubTask[] = [
        createSubTask({ deps: [], id: "task-1" }),
        createSubTask({ deps: [], id: "task-2" }),
      ];

      const failures = new Map<string, FailureContext>([
        ["task-1", createFailureContext({ taskId: "task-1" })],
      ]);

      const propagated = propagateUpstreamFailures(tasks, failures);

      // Neither task should have upstream failures (no deps)
      expect(propagated[0].metadata?.upstreamFailures).toBeUndefined();
      expect(propagated[1].metadata?.upstreamFailures).toBeUndefined();
    });

    it("should handle missing dependencies gracefully", () => {
      const tasks: SubTask[] = [
        createSubTask({ deps: ["non-existent"], id: "task-1" }),
      ];

      const failures = new Map<string, FailureContext>([
        ["other-task", createFailureContext({ taskId: "other-task" })],
      ]);

      // Should not throw
      const propagated = propagateUpstreamFailures(tasks, failures);

      expect(propagated).toHaveLength(1);
    });

    it("should limit upstream failures with maxUpstreamFailures option", () => {
      const tasks: SubTask[] = [
        createSubTask({ deps: [], id: "task-1" }),
        createSubTask({ deps: [], id: "task-2" }),
        createSubTask({ deps: [], id: "task-3" }),
        createSubTask({ deps: ["task-1", "task-2", "task-3"], id: "task-4" }),
      ];

      const failures = new Map<string, FailureContext>([
        ["task-1", createFailureContext({ taskId: "task-1" })],
        ["task-2", createFailureContext({ taskId: "task-2" })],
        ["task-3", createFailureContext({ taskId: "task-3" })],
      ]);

      const propagated = propagateUpstreamFailures(tasks, failures, {
        maxUpstreamFailures: 2,
      });

      // task-4 should have at most 2 upstream failures
      const upstreamFailures = propagated[3].metadata?.upstreamFailures ?? [];
      expect(upstreamFailures.length).toBeLessThanOrEqual(2);
    });
  });
});
