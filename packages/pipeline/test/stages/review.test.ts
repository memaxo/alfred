import { describe, expect, it } from "bun:test";

import { type PipelineEvent } from "../../src/events";
import { type PipelineConfig, type PipelineContext } from "../../src/pipeline";
import { DEFAULT_CONFIG } from "../../src/pipeline";
import { type AgentOutcome, type ExecuteOutput } from "../../src/stages/types";

/**
 * Review Stage Tests
 *
 * Tests the review stage configuration, event emission,
 * and ReviewGate integration.
 */

// Mock context factory
function createMockContext(
  overrides: Partial<{
    config: Partial<PipelineConfig>;
    storage: Map<string, unknown>;
    events: PipelineEvent[];
  }> = {}
): PipelineContext {
  const storage = overrides.storage ?? new Map<string, unknown>();
  const events: PipelineEvent[] = overrides.events ?? [];
  const config = { ...DEFAULT_CONFIG, ...overrides.config };

  return {
    config,
    emit: (event: PipelineEvent) => events.push(event),
    get: <T>(key: string) => storage.get(key) as T | undefined,
    requirement: "test requirement",
    runId: "test-run-1",
    set: (key: string, value: unknown) => storage.set(key, value),
    signal: new AbortController().signal,
    userId: "test-user",
    workspace: "/tmp/test-workspace",
  };
}

// Create mock execute output
function createMockExecuteOutput(
  outcomesList: [string, Partial<AgentOutcome>][] = []
): ExecuteOutput {
  const outcomes = new Map<string, AgentOutcome>();
  for (const [taskId, partial] of outcomesList) {
    outcomes.set(taskId, {
      agentId: partial.agentId ?? `agent-${taskId}`,
      durationSeconds: partial.durationSeconds ?? 10,
      escalation: partial.escalation,
      phaseId: partial.phaseId ?? "execute",
      result: partial.result,
      role: partial.role ?? "agent",
      status: partial.status ?? "success",
      stuck: partial.stuck ?? false,
    });
  }

  return {
    fileChanges: [],
    handoffs: [],
    outcomes,
  };
}

describe("ReviewStage", () => {
  describe("Configuration", () => {
    it("respects reviewFixer enabled config", () => {
      const config: Partial<PipelineConfig> = {
        reviewFixer: {
          enabled: true,
          maxAttempts: 5,
        },
      };

      const ctx = createMockContext({ config });

      expect(ctx.config.reviewFixer?.enabled).toBe(true);
      expect(ctx.config.reviewFixer?.maxAttempts).toBe(5);
    });

    it("defaults reviewFixer to disabled", () => {
      const ctx = createMockContext({});

      expect(ctx.config.reviewFixer?.enabled).toBe(false);
    });
  });

  describe("Event Types", () => {
    it("defines review:check event structure", () => {
      const event: PipelineEvent = {
        check: {
          name: "Agent task-1",
          passed: true,
          message: "Completed successfully",
        },
        timestamp: Date.now(),
        type: "review:check",
      };

      expect(event.type).toBe("review:check");
      expect(event.check.passed).toBe(true);
    });

    it("defines review:fix-start event structure", () => {
      const event: PipelineEvent = {
        attempt: 1,
        maxAttempts: 3,
        timestamp: Date.now(),
        type: "review:fix-start",
      };

      expect(event.type).toBe("review:fix-start");
      expect(event.attempt).toBe(1);
      expect(event.maxAttempts).toBe(3);
    });

    it("defines review:fix-complete event structure", () => {
      const event: PipelineEvent = {
        attempt: 1,
        success: true,
        timestamp: Date.now(),
        type: "review:fix-complete",
      };

      expect(event.type).toBe("review:fix-complete");
      expect(event.success).toBe(true);
    });
  });

  describe("Context Storage", () => {
    it("stores review gate state in context", () => {
      const storage = new Map<string, unknown>();
      const ctx = createMockContext({ storage });

      // Simulate what review stage does
      const gateState = {
        checks: [{ id: "task-1", type: "agent_completion", status: "passed" }],
        minimumRequired: 1,
        planInitialized: false,
        planRequired: false,
      };
      ctx.set("reviewGateState", gateState);

      expect(storage.get("reviewGateState")).toEqual(gateState);
    });

    it("stores fix attempts in context", () => {
      const storage = new Map<string, unknown>();
      const ctx = createMockContext({ storage });

      ctx.set("fixAttempts", 2);

      expect(storage.get("fixAttempts")).toBe(2);
    });

    it("stores review output in context", () => {
      const storage = new Map<string, unknown>();
      const ctx = createMockContext({ storage });

      const reviewOutput = {
        allPassed: true,
        checks: [{ name: "test", passed: true }],
        fixAttempts: 0,
      };
      ctx.set("reviewOutput", reviewOutput);

      expect(storage.get("reviewOutput")).toEqual(reviewOutput);
    });
  });

  describe("Execute Output Processing", () => {
    it("handles empty outcomes", () => {
      const input = createMockExecuteOutput([]);

      expect(input.outcomes.size).toBe(0);
    });

    it("handles successful outcomes", () => {
      const input = createMockExecuteOutput([
        ["task-1", { status: "success" }],
        ["task-2", { status: "success" }],
      ]);

      expect(input.outcomes.size).toBe(2);
      for (const outcome of input.outcomes.values()) {
        expect(outcome.status).toBe("success");
      }
    });

    it("handles mixed outcomes", () => {
      const input = createMockExecuteOutput([
        ["task-1", { status: "success" }],
        ["task-2", { escalation: "Test failed", status: "failure" }],
        ["task-3", { escalation: "Need review", status: "escalated" }],
      ]);

      expect(input.outcomes.size).toBe(3);

      const statuses = [...input.outcomes.values()].map((o) => o.status);
      expect(statuses).toContain("success");
      expect(statuses).toContain("failure");
      expect(statuses).toContain("escalated");
    });

    it("handles stuck agents", () => {
      const input = createMockExecuteOutput([
        ["task-1", { status: "stuck", stuck: true }],
      ]);

      const outcome = input.outcomes.get("task-1");
      expect(outcome?.stuck).toBe(true);
    });
  });

  describe("ReviewGate State Serialization", () => {
    it("can serialize gate state", () => {
      // This tests the format expected by ReviewGate.serialize()
      const serializedState = {
        checks: [
          {
            id: "task-1",
            type: "agent_completion",
            status: "passed",
            evidence: "Completed",
          },
          {
            id: "task-2",
            type: "agent_completion",
            status: "failed",
            evidence: "Error occurred",
          },
        ],
        minimumRequired: 1,
        planInitialized: true,
        planRequired: false,
      };

      // Should be JSON-serializable
      const json = JSON.stringify(serializedState);
      const parsed = JSON.parse(json);

      expect(parsed.checks).toHaveLength(2);
      expect(parsed.checks[0].status).toBe("passed");
    });

    it("can restore gate state", () => {
      const storage = new Map<string, unknown>();
      const savedState = {
        checks: [{ id: "task-1", type: "agent_completion", status: "passed" }],
        minimumRequired: 0,
        planInitialized: false,
        planRequired: false,
      };
      storage.set("reviewGateState", savedState);

      const ctx = createMockContext({ storage });

      // Simulate what review stage does on resume
      const restoredState = ctx.get<typeof savedState>("reviewGateState");

      expect(restoredState?.checks).toHaveLength(1);
      expect(restoredState?.checks?.[0]?.id).toBe("task-1");
    });
  });

  describe("Linear Integration", () => {
    it("detects Linear session ID", () => {
      const storage = new Map<string, unknown>();
      storage.set("linearSessionId", "session-123");

      const ctx = createMockContext({ storage });

      const sessionId = ctx.get<string>("linearSessionId");
      expect(sessionId).toBe("session-123");
    });

    it("handles missing Linear session ID", () => {
      const ctx = createMockContext({});

      const sessionId = ctx.get<string>("linearSessionId");
      expect(sessionId).toBeUndefined();
    });
  });

  describe("Fixer Loop Integration", () => {
    it("builds correct fixer subtask", async () => {
      const { buildFixerSubTask } =
        await import("@alfred/agent/orchestrator/multi/review");

      const subtask = buildFixerSubTask({
        attempt: 1,
        relevantFiles: ["file1.ts"],
        summary: "Fix tests",
      });

      expect(subtask.id).toBe("fixer01");
      expect(subtask.title).toContain("Fix review failures");
      expect(subtask.filesHint).toContain("file1.ts");
    });
  });
});
