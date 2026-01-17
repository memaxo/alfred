import { describe, expect, it } from "bun:test";
import type { PipelineEvent } from "../../src/events";
import type { PipelineConfig, PipelineContext } from "../../src/pipeline";
import { DEFAULT_CONFIG } from "../../src/pipeline";
import type { ScheduleOutput, WavePlan } from "../../src/stages/types";

/**
 * Execute Stage Tests
 *
 * Tests the execute stage configuration and event emission.
 * Full integration tests require mocking the agent runtime.
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
    runId: "test-run-1",
    requirement: "test requirement",
    workspace: "/tmp/test-workspace",
    userId: "test-user",
    signal: new AbortController().signal,
    config,
    emit: (event: PipelineEvent) => events.push(event),
    get: <T>(key: string) => storage.get(key) as T | undefined,
    set: (key: string, value: unknown) => storage.set(key, value),
  };
}

// Mock schedule output
function createMockScheduleOutput(waves: WavePlan[] = []): ScheduleOutput {
  return {
    waves,
    executionMode: "sequential",
    estimatedDuration: 0,
  };
}

describe("ExecuteStage", () => {
  describe("Configuration", () => {
    it("respects stuck detection config", () => {
      const config: Partial<PipelineConfig> = {
        stuckDetection: {
          noProgressMs: 30_000,
          maxTransitions: 100,
          similarityThreshold: 0.95,
        },
      };

      const ctx = createMockContext({ config });

      expect(ctx.config.stuckDetection?.noProgressMs).toBe(30_000);
      expect(ctx.config.stuckDetection?.maxTransitions).toBe(100);
      expect(ctx.config.stuckDetection?.similarityThreshold).toBe(0.95);
    });

    it("respects retry config", () => {
      const config: Partial<PipelineConfig> = {
        retries: {
          maxAgentAttempts: 3,
          retryableStatuses: ["failure", "stuck"],
          backoffMs: 2000,
        },
      };

      const ctx = createMockContext({ config });

      expect(ctx.config.retries?.maxAgentAttempts).toBe(3);
      expect(ctx.config.retries?.retryableStatuses).toContain("failure");
      expect(ctx.config.retries?.retryableStatuses).toContain("stuck");
      expect(ctx.config.retries?.backoffMs).toBe(2000);
    });

    it("respects wave abort config", () => {
      const config: Partial<PipelineConfig> = {
        waveAbort: {
          waveFailureThreshold: 0.3,
          overallFailureThreshold: 0.2,
        },
      };

      const ctx = createMockContext({ config });

      expect(ctx.config.waveAbort?.waveFailureThreshold).toBe(0.3);
      expect(ctx.config.waveAbort?.overallFailureThreshold).toBe(0.2);
    });
  });

  describe("Event Types", () => {
    it("defines agent:stuck event structure", () => {
      const event: PipelineEvent = {
        type: "agent:stuck",
        agentId: "agent-1",
        reason: "no_progress",
        timestamp: Date.now(),
      };

      expect(event.type).toBe("agent:stuck");
      expect(event.agentId).toBe("agent-1");
      expect(event.reason).toBe("no_progress");
    });

    it("defines agent:escalated event structure", () => {
      const event: PipelineEvent = {
        type: "agent:escalated",
        agentId: "agent-1",
        reason: "Need human review",
        timestamp: Date.now(),
      };

      expect(event.type).toBe("agent:escalated");
      expect(event.reason).toBe("Need human review");
    });

    it("defines agent:retry event structure", () => {
      const event: PipelineEvent = {
        type: "agent:retry",
        agentId: "agent-1",
        attempt: 2,
        maxAttempts: 3,
        timestamp: Date.now(),
      };

      expect(event.type).toBe("agent:retry");
      expect(event.attempt).toBe(2);
      expect(event.maxAttempts).toBe(3);
    });

    it("defines wave:aborted event structure", () => {
      const event: PipelineEvent = {
        type: "wave:aborted",
        waveId: "wave-1",
        waveFailRate: 0.6,
        overallFailRate: 0.4,
        timestamp: Date.now(),
      };

      expect(event.type).toBe("wave:aborted");
      expect(event.waveFailRate).toBe(0.6);
      expect(event.overallFailRate).toBe(0.4);
    });
  });

  describe("Context Storage", () => {
    it("stores tracker state in context", () => {
      const storage = new Map<string, unknown>();
      const ctx = createMockContext({ storage });

      // Simulate what execute stage does
      const trackerState = {
        agents: { "agent-1": { status: "running" } },
        waves: { "wave-1": { started: true } },
      };
      ctx.set("trackerState", trackerState);

      expect(storage.get("trackerState")).toEqual(trackerState);
    });

    it("stores execute output in context", () => {
      const storage = new Map<string, unknown>();
      const ctx = createMockContext({ storage });

      const executeOutput = {
        outcomes: [["task-1", { status: "success" }]],
        fileChanges: [{ path: "/file.ts", action: "modify" }],
        handoffs: ["Agent completed task"],
      };
      ctx.set("executeOutputSerialized", executeOutput);

      expect(storage.get("executeOutputSerialized")).toEqual(executeOutput);
    });
  });

  describe("Schedule Input", () => {
    it("handles empty waves", () => {
      const input = createMockScheduleOutput([]);

      expect(input.waves).toHaveLength(0);
      expect(input.executionMode).toBe("sequential");
    });

    it("handles multiple waves", () => {
      const waves: WavePlan[] = [
        { id: "wave-1", agents: ["task-1", "task-2"], dependsOn: [] },
        { id: "wave-2", agents: ["task-3"], dependsOn: ["wave-1"] },
      ];
      const input = createMockScheduleOutput(waves);

      expect(input.waves).toHaveLength(2);
      expect(input.waves[0]?.agents).toContain("task-1");
      expect(input.waves[1]?.dependsOn).toContain("wave-1");
    });
  });

  describe("TrackerContext Serialization", () => {
    it("serializes and restores TrackerContext correctly", async () => {
      const { createTrackerContext } = await import(
        "@alfred/agent/orchestrator/multi/tracker"
      );
      const { toSerializable, fromSerializable } = await import(
        "../../src/snapshot"
      );

      const tasks = [
        {
          id: "task-1",
          title: "Test",
          requirement: "req",
          deps: [],
          priority: 1,
          acceptance: [],
          filesHint: [],
        },
      ];
      const trackerContext = createTrackerContext(tasks);
      trackerContext.state.agents["agent-1"] = {
        subTaskId: "task-1",
        status: "running",
        lastEventTs: Date.now(),
      };

      const serializable = toSerializable(trackerContext);
      const restored = fromSerializable(serializable) as any;

      expect(restored.state.agents["agent-1"].status).toBe("running");
      expect(restored.options.noProgressMs).toBe(60_000);
    });

    it("detects stuck agent correctly", async () => {
      const { createTrackerContext, detectStuckWithContext } = await import(
        "@alfred/agent/orchestrator/multi/tracker"
      );

      const trackerContext = createTrackerContext([]);
      const now = Date.now();
      trackerContext.state.agents["agent-1"] = {
        subTaskId: "task-1",
        status: "running",
        lastEventTs: now - 70_000, // Older than 60s default
      };

      expect(detectStuckWithContext(trackerContext, "agent-1", now)).toBe(true);

      trackerContext.state.agents["agent-1"].lastEventTs = now - 30_000;
      expect(detectStuckWithContext(trackerContext, "agent-1", now)).toBe(
        false
      );
    });
  });
});
