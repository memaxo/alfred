import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { PipelineEvent } from "../../src/events";
import { createEvent } from "../../src/events";
import {
  CheckpointObserver,
  InMemoryCheckpointStorage,
} from "../../src/observers/checkpoint";
import type { PipelineContext, StageName } from "../../src/pipeline";
import { DEFAULT_CONFIG } from "../../src/pipeline";
import { PipelineRunner } from "../../src/runner";
import type { PipelineSnapshot } from "../../src/snapshot";
import { PipelineReconstructor } from "../../src/snapshot";

/**
 * Mock stages for testing resume functionality.
 */
function createMockStage(name: StageName, output: unknown) {
  return {
    name,
    execute: async (_input: unknown, ctx: PipelineContext) => {
      // Store stage output in context for resume
      ctx.set(`${name}Output`, output);
      return output;
    },
  };
}

describe("Pipeline Resume Integration", () => {
  let storage: InMemoryCheckpointStorage;
  let observer: CheckpointObserver;
  let runner: PipelineRunner;
  let collectedEvents: PipelineEvent[];

  beforeEach(() => {
    storage = new InMemoryCheckpointStorage();
    observer = new CheckpointObserver(storage);
    collectedEvents = [];

    runner = new PipelineRunner({
      ...DEFAULT_CONFIG,
      phaseTimeouts: {
        init: 1000,
        context: 1000,
        plan: 1000,
        schedule: 1000,
        execute: 1000,
        review: 1000,
        learn: 1000,
        summarize: 1000,
      },
    });

    // Register mock stages with serializable outputs
    runner.registerStage(createMockStage("init", { projectId: "p1" }));
    runner.registerStage(createMockStage("context", { totalTokens: 1000 }));
    runner.registerStage(createMockStage("plan", { subtasks: [] }));
    runner.registerStage(createMockStage("schedule", { waves: [] }));
    // Execute output must be serializable - use array instead of Map
    runner.registerStage(
      createMockStage("execute", {
        outcomes: [],
        fileChanges: [],
        handoffs: [],
      })
    );
    runner.registerStage(
      createMockStage("review", { allPassed: true, checks: [], fixAttempts: 0 })
    );
    runner.registerStage(createMockStage("learn", { insights: [] }));
    runner.registerStage(createMockStage("summarize", { summary: "done" }));

    runner.addObserver(observer);
    runner.addObserver({
      onEvent: (event) => collectedEvents.push(event),
    });
  });

  afterEach(() => {
    storage.clear();
  });

  describe("CheckpointObserver", () => {
    it("checkpoints after each stage completion (but deletes on complete)", async () => {
      const input = {
        runId: "run-1",
        requirement: "test requirement",
        workspace: "/tmp/test",
        userId: "user-1",
      };

      // Track checkpoints during execution
      let midExecutionCheckpoint: ReturnType<typeof storage.getAll> | undefined;

      const checkpointTracker = {
        onEvent: (event: PipelineEvent) => {
          if (
            event.type === "stage:exit" &&
            (event as { stage: StageName }).stage === "execute"
          ) {
            midExecutionCheckpoint = storage.getAll();
          }
        },
      };
      runner.addObserver(checkpointTracker);

      const generator = runner.run(input);
      for await (const _event of generator) {
        // Consume all events
      }

      // After completion, checkpoint is deleted (by design)
      const checkpoint = await storage.load("run-1");
      expect(checkpoint).toBeNull(); // Deleted on completion

      // But during execution, there was a checkpoint
      expect(midExecutionCheckpoint?.size).toBeGreaterThan(0);
    });

    it("tracks context changes during execution", async () => {
      const input = {
        runId: "run-2",
        requirement: "test",
        workspace: "/tmp/test",
        userId: "user-1",
      };

      collectedEvents = []; // Reset events
      const generator = runner.run(input);
      for await (const _event of generator) {
        // Consume events
      }

      // Context set events are emitted via observers when stages call ctx.set()
      const contextSetEvents = collectedEvents.filter(
        (e) => e.type === "context:set"
      );

      // Mock stages call ctx.set() for their output
      // Each stage stores its output in context (8 stages = 8 context:set events)
      expect(contextSetEvents.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("PipelineRunner.resume()", () => {
    it("rejects mismatched runId", async () => {
      const snapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "suspended",
        requirement: "test",
        lastCompletedStage: "context",
        lastCompletedStageIndex: 1,
        contextEntries: [],
        stageResults: [
          { name: "init", durationMs: 50, status: "success" },
          { name: "context", durationMs: 100, status: "success" },
        ],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      const input = {
        runId: "run-2", // Different!
        requirement: "test",
        workspace: "/tmp/test",
        userId: "user-1",
      };

      const generator = runner.resume(snapshot, input);

      await expect(async () => {
        for await (const _ of generator) {
          // Should throw before yielding
        }
      }).toThrow(/does not match/);
    });

    it("rejects completed pipeline", async () => {
      const snapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "completed",
        requirement: "test",
        lastCompletedStage: "summarize",
        lastCompletedStageIndex: 7,
        contextEntries: [],
        stageResults: [],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      const input = {
        runId: "run-1",
        requirement: "test",
        workspace: "/tmp/test",
        userId: "user-1",
      };

      const generator = runner.resume(snapshot, input);

      await expect(async () => {
        for await (const _ of generator) {
          // Should throw
        }
      }).toThrow(/Cannot resume completed/);
    });

    it("skips completed stages", async () => {
      // Snapshot at context completion
      const snapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "running",
        requirement: "test",
        lastCompletedStage: "context",
        lastCompletedStageIndex: 1,
        contextEntries: [
          ["initOutput", { projectId: "p1" }],
          ["contextOutput", { totalTokens: 1000 }],
        ],
        stageResults: [
          { name: "init", durationMs: 50, status: "success" },
          { name: "context", durationMs: 100, status: "success" },
        ],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      const input = {
        runId: "run-1",
        requirement: "test",
        workspace: "/tmp/test",
        userId: "user-1",
      };

      collectedEvents = [];
      const generator = runner.resume(snapshot, input);

      for await (const _ of generator) {
        // Consume events
      }

      // Should have resume event
      const resumeEvent = collectedEvents.find(
        (e) => e.type === "pipeline:resume"
      );
      expect(resumeEvent).toBeDefined();
      expect((resumeEvent as { fromStage: StageName }).fromStage).toBe("plan");

      // Should NOT have init or context stage:enter events
      const stageEnters = collectedEvents.filter(
        (e) => e.type === "stage:enter"
      );
      const stages = stageEnters.map((e) => (e as { stage: StageName }).stage);
      expect(stages).not.toContain("init");
      expect(stages).not.toContain("context");

      // Should have plan and subsequent stages
      expect(stages).toContain("plan");
      expect(stages).toContain("schedule");
      expect(stages).toContain("execute");
    });

    it("restores context entries", async () => {
      const snapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "running",
        requirement: "test",
        lastCompletedStage: "init",
        lastCompletedStageIndex: 0,
        contextEntries: [
          ["customKey", "customValue"],
          ["initOutput", { projectId: "p1" }],
        ],
        stageResults: [{ name: "init", durationMs: 50, status: "success" }],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      const input = {
        runId: "run-1",
        requirement: "test",
        workspace: "/tmp/test",
        userId: "user-1",
      };

      // Create a stage that reads from context
      let contextValue: unknown;
      const testStage = {
        name: "context" as const,
        execute: async (_input: unknown, ctx: PipelineContext) => {
          contextValue = ctx.get("customKey");
          ctx.set("contextOutput", { totalTokens: 1000 });
          return { totalTokens: 1000 };
        },
      };

      // Replace context stage
      const testRunner = new PipelineRunner(DEFAULT_CONFIG);
      testRunner.registerStage(createMockStage("init", {}));
      testRunner.registerStage(testStage);
      testRunner.registerStage(createMockStage("plan", {}));
      testRunner.registerStage(createMockStage("schedule", {}));
      testRunner.registerStage(createMockStage("execute", {}));
      testRunner.registerStage(createMockStage("review", {}));
      testRunner.registerStage(createMockStage("learn", {}));
      testRunner.registerStage(createMockStage("summarize", {}));

      const generator = testRunner.resume(snapshot, input);
      for await (const _ of generator) {
        // Consume
      }

      expect(contextValue).toBe("customValue");
    });
  });

  describe("PipelineReconstructor integration", () => {
    it("reconstructs state from collected events", async () => {
      const input = {
        runId: "run-1",
        requirement: "test requirement",
        workspace: "/tmp/test",
        userId: "user-1",
      };

      const allEvents: PipelineEvent[] = [];
      const eventCollector = {
        onEvent: (event: PipelineEvent) => allEvents.push(event),
      };

      runner.addObserver(eventCollector);

      const generator = runner.run(input);
      for await (const _ of generator) {
        // Consume
      }

      // Reconstruct state from events
      const reconstructor = new PipelineReconstructor();
      const state = reconstructor.reconstruct(allEvents);

      expect(state.runId).toBe("run-1");
      expect(state.status).toBe("completed");
      expect(state.stageResults.length).toBe(8);
    });

    it("reconstructs partial state for suspend", async () => {
      // Simulate events up to a suspend
      const events: PipelineEvent[] = [
        createEvent("pipeline:start", { runId: "run-1", requirement: "test" }),
        createEvent("stage:enter", { stage: "init" }),
        createEvent("stage:exit", { stage: "init", durationMs: 50 }),
        createEvent("stage:enter", { stage: "context" }),
        createEvent("stage:exit", { stage: "context", durationMs: 100 }),
        {
          type: "context:set",
          key: "subtasks",
          value: [{ id: "t1" }],
          timestamp: Date.now(),
        },
        createEvent("pipeline:suspend", { reason: "user request" }),
      ];

      const reconstructor = new PipelineReconstructor();
      const state = reconstructor.reconstruct(events);

      expect(state.status).toBe("suspended");
      expect(state.lastCompletedStage).toBe("context");
      expect(state.lastCompletedStageIndex).toBe(1);
      expect(state.contextEntries).toHaveLength(1);
      const firstEntry = state.contextEntries[0];
      expect(firstEntry).toBeDefined();
      expect(firstEntry?.[0]).toBe("subtasks");
    });
  });
});
