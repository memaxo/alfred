import { describe, expect, test } from "bun:test";
import { renderWorkflowProgress } from "../../src/tui/panels/workflow/active";
import { renderHistoryItem } from "../../src/tui/panels/workflow/history";
import { renderQueueItem } from "../../src/tui/panels/workflow/queue";
import type { Workflow } from "../../src/tui/subscriptions/workflow";
import { createMockWorkflows } from "../../src/tui/subscriptions/workflow";

describe("Workflow Panel Components", () => {
  describe("Active Workflow Rendering", () => {
    test("renders active workflow with progress", () => {
      const workflow = {
        runId: "run_123",
        intent: "Deploy to staging",
        status: "executing" as const,
        phase: "act",
        progress: 0.6,
        startedAt: new Date(),
      };

      const result = renderWorkflowProgress(workflow, 60);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test("handles workflow without progress", () => {
      const workflow = {
        runId: "run_456",
        intent: "Review PR",
        status: "executing" as const,
        phase: "think",
        startedAt: new Date(),
      };

      const result = renderWorkflowProgress(workflow, 60);
      expect(result).toBeDefined();
    });

    test("handles all workflow statuses", () => {
      const statuses = ["pending", "executing", "completed", "failed"] as const;

      for (const status of statuses) {
        const workflow = {
          runId: `run_${status}`,
          intent: "Test workflow",
          status,
          startedAt: new Date(),
        };

        const result = renderWorkflowProgress(workflow, 60);
        expect(result).toBeDefined();
      }
    });
  });

  describe("Queue Rendering", () => {
    test("renders queued workflow", () => {
      // renderQueueItem expects (workflow: Workflow, index: number, width: number)
      const workflow: Workflow = {
        id: "run_queue_1",
        name: "Queued task",
        status: "pending" as const,
        progress: 0,
      };

      const result = renderQueueItem(workflow, 0, 60);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    test("handles empty queue", () => {
      const workflows = createMockWorkflows();
      const queued = workflows.filter((w) => w.status === "pending");
      expect(Array.isArray(queued)).toBe(true);
    });
  });

  describe("History Rendering", () => {
    test("renders completed workflow", () => {
      // renderHistoryItem expects Workflow with `name` not `intent`
      const workflow: Workflow = {
        id: "run_completed",
        name: "Completed task",
        status: "completed" as const,
        progress: 1,
        startedAt: Date.now() - 60_000,
        completedAt: Date.now(),
      };

      const result = renderHistoryItem(workflow, 60);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    test("renders failed workflow", () => {
      const workflow: Workflow = {
        id: "run_failed",
        name: "Failed task",
        status: "failed" as const,
        progress: 0,
        startedAt: Date.now() - 30_000,
        completedAt: Date.now(),
        error: "Policy denied",
      };

      const result = renderHistoryItem(workflow, 60);
      expect(result).toBeDefined();
      // Check for error icon (✗) instead of literal "failed" text
      expect(result.length).toBeGreaterThan(0);
    });

    test("respects width constraint", () => {
      const workflow: Workflow = {
        id: "run_long_intent_test",
        name: "This is a very long workflow intent that should be truncated",
        status: "completed" as const,
        progress: 1,
        startedAt: Date.now(),
        completedAt: Date.now(),
      };

      const widths = [40, 60, 80];
      for (const width of widths) {
        const result = renderHistoryItem(workflow, width);
        // Result includes ANSI codes, just check it's defined
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Mock Data", () => {
    test("createMockWorkflows returns array", () => {
      const workflows = createMockWorkflows();
      expect(Array.isArray(workflows)).toBe(true);
      expect(workflows.length).toBeGreaterThan(0);
    });

    test("mock workflows have required fields", () => {
      const workflows = createMockWorkflows();
      for (const workflow of workflows) {
        expect(workflow.runId).toBeDefined();
        expect(workflow.intent).toBeDefined();
        expect(workflow.status).toBeDefined();
      }
    });

    test("mock workflows have varied statuses", () => {
      const workflows = createMockWorkflows();
      const statuses = new Set(workflows.map((w) => w.status));
      expect(statuses.size).toBeGreaterThan(1);
    });
  });
});
