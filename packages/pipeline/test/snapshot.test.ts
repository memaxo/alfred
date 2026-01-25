import { describe, expect, it } from "bun:test";

import type { PipelineEvent } from "../src/events";

import { createEvent } from "../src/events";
import {
  assertSerializable,
  contextEntriesToMap,
  createInitialSnapshot,
  createSnapshot,
  isSerializable,
  mapToContextEntries,
  PipelineReconstructor,
  type PipelineSnapshot,
} from "../src/snapshot";

describe("PipelineSnapshot", () => {
  describe("isSerializable", () => {
    it("accepts primitives", () => {
      expect(isSerializable("string")).toBe(true);
      expect(isSerializable(123)).toBe(true);
      expect(isSerializable(true)).toBe(true);
      expect(isSerializable(null)).toBe(true);
    });

    it("accepts arrays of primitives", () => {
      expect(isSerializable([1, 2, 3])).toBe(true);
      expect(isSerializable(["a", "b"])).toBe(true);
      expect(isSerializable([true, false])).toBe(true);
    });

    it("accepts plain objects", () => {
      expect(isSerializable({ key: "value" })).toBe(true);
      expect(isSerializable({ nested: { deep: 1 } })).toBe(true);
    });

    it("rejects class instances", () => {
      expect(isSerializable(new Map())).toBe(false);
      expect(isSerializable(new Set())).toBe(false);
      expect(isSerializable(new Date())).toBe(false);
    });

    it("rejects functions", () => {
      expect(isSerializable(() => {})).toBe(false);
    });

    it("rejects undefined", () => {
      expect(isSerializable(void 0)).toBe(false);
    });

    it("rejects Infinity and NaN", () => {
      expect(isSerializable(Number.POSITIVE_INFINITY)).toBe(false);
      expect(isSerializable(Number.NaN)).toBe(false);
    });
  });

  describe("assertSerializable", () => {
    it("passes for valid values", () => {
      expect(() => assertSerializable("key", "value")).not.toThrow();
      expect(() => assertSerializable("key", { a: 1 })).not.toThrow();
    });

    it("throws for invalid values", () => {
      expect(() => assertSerializable("key", new Map())).toThrow(
        /not serializable/
      );
      expect(() => assertSerializable("key", () => {})).toThrow(
        /not serializable/
      );
    });
  });

  describe("createInitialSnapshot", () => {
    it("creates empty snapshot", () => {
      const snapshot = createInitialSnapshot();

      expect(snapshot.runId).toBe("");
      expect(snapshot.status).toBe("idle");
      expect(snapshot.lastCompletedStage).toBeNull();
      expect(snapshot.lastCompletedStageIndex).toBe(-1);
      expect(snapshot.contextEntries).toEqual([]);
      expect(snapshot.stageResults).toEqual([]);
    });
  });

  describe("contextEntriesToMap / mapToContextEntries", () => {
    it("round-trips entries", () => {
      const entries: [string, string][] = [
        ["key1", "value1"],
        ["key2", "value2"],
      ];
      const map = contextEntriesToMap(entries);
      const roundTripped = mapToContextEntries(map);

      expect(roundTripped).toEqual(entries);
    });
  });
});

describe("PipelineReconstructor", () => {
  const reconstructor = new PipelineReconstructor();

  describe("reduce", () => {
    it("is pure (does not modify input)", () => {
      const initial = createInitialSnapshot();
      const event = createEvent("pipeline:start", {
        runId: "run-1",
        requirement: "test",
      });

      const result = reconstructor.reduce(initial, event);

      expect(initial.runId).toBe("");
      expect(result.runId).toBe("run-1");
    });

    it("handles pipeline:start", () => {
      const event = createEvent("pipeline:start", {
        runId: "run-1",
        requirement: "test requirement",
      });

      const result = reconstructor.reduce(reconstructor.initialState, event);

      expect(result.runId).toBe("run-1");
      expect(result.requirement).toBe("test requirement");
      expect(result.status).toBe("running");
    });

    it("handles stage:exit", () => {
      let state = reconstructor.initialState;
      state = reconstructor.reduce(
        state,
        createEvent("pipeline:start", { runId: "run-1", requirement: "test" })
      );
      state = reconstructor.reduce(
        state,
        createEvent("stage:exit", { stage: "init", durationMs: 100 })
      );

      expect(state.lastCompletedStage).toBe("init");
      expect(state.lastCompletedStageIndex).toBe(0);
      expect(state.stageResults).toHaveLength(1);
      expect(state.stageResults[0]).toEqual({
        name: "init",
        durationMs: 100,
        status: "success",
      });
    });

    it("handles context:set", () => {
      const event: PipelineEvent = {
        type: "context:set",
        key: "testKey",
        value: { nested: "value" },
        timestamp: Date.now(),
      };

      const result = reconstructor.reduce(reconstructor.initialState, event);

      expect(result.contextEntries).toHaveLength(1);
      expect(result.contextEntries[0]).toEqual([
        "testKey",
        { nested: "value" },
      ]);
    });

    it("handles pipeline:suspend", () => {
      let state = reconstructor.reduce(
        reconstructor.initialState,
        createEvent("pipeline:start", { runId: "run-1", requirement: "test" })
      );
      state = reconstructor.reduce(
        state,
        createEvent("pipeline:suspend", { reason: "user request" })
      );

      expect(state.status).toBe("suspended");
    });

    it("handles pipeline:resume", () => {
      let state = reconstructor.initialState;
      state = reconstructor.reduce(
        state,
        createEvent("pipeline:start", { runId: "run-1", requirement: "test" })
      );
      state = reconstructor.reduce(
        state,
        createEvent("pipeline:suspend", { reason: "user request" })
      );
      state = reconstructor.reduce(
        state,
        createEvent("pipeline:resume", { fromStage: "context" })
      );

      expect(state.status).toBe("running");
    });

    it("handles pipeline:complete", () => {
      let state = reconstructor.reduce(
        reconstructor.initialState,
        createEvent("pipeline:start", { runId: "run-1", requirement: "test" })
      );
      state = reconstructor.reduce(
        state,
        createEvent("pipeline:complete", {
          summary: {
            runId: "run-1",
            requirement: "test",
            stages: [],
            totalDurationMs: 1000,
            agentsSpawned: 2,
            filesChanged: 5,
            learningInsights: 1,
          },
        })
      );

      expect(state.status).toBe("completed");
    });

    it("handles pipeline:failed", () => {
      let state = reconstructor.reduce(
        reconstructor.initialState,
        createEvent("pipeline:start", { runId: "run-1", requirement: "test" })
      );
      state = reconstructor.reduce(
        state,
        createEvent("pipeline:failed", {
          error: "Something went wrong",
          lastStage: "execute",
        })
      );

      expect(state.status).toBe("failed");
      expect(state.error).toBe("Something went wrong");
    });
  });

  describe("reconstruct", () => {
    it("rebuilds state from event stream", () => {
      const events: PipelineEvent[] = [
        createEvent("pipeline:start", { runId: "run-1", requirement: "test" }),
        createEvent("stage:enter", { stage: "init" }),
        createEvent("stage:exit", { stage: "init", durationMs: 50 }),
        createEvent("stage:enter", { stage: "context" }),
        createEvent("stage:exit", { stage: "context", durationMs: 100 }),
        {
          type: "context:set",
          key: "subtasks",
          value: [{ id: "t1", title: "Task 1" }],
          timestamp: Date.now(),
        },
      ];

      const state = reconstructor.reconstruct(events);

      expect(state.runId).toBe("run-1");
      expect(state.lastCompletedStage).toBe("context");
      expect(state.lastCompletedStageIndex).toBe(1);
      expect(state.stageResults).toHaveLength(2);
      expect(state.contextEntries).toHaveLength(1);
    });
  });

  describe("reconstructAt", () => {
    it("stops at specific event", () => {
      const events: PipelineEvent[] = [
        createEvent("pipeline:start", { runId: "run-1", requirement: "test" }),
        createEvent("stage:exit", { stage: "init", durationMs: 50 }),
        createEvent("stage:exit", { stage: "context", durationMs: 100 }),
      ];

      // Stop at init completion
      const initEvent = events[1]!;
      const eventId = `${initEvent.type}:${initEvent.timestamp}`;

      const state = reconstructor.reconstructAt(events, eventId);

      expect(state.lastCompletedStage).toBe("init");
      expect(state.stageResults).toHaveLength(1);
    });
  });

  describe("reconstructFromSnapshot", () => {
    it("continues from snapshot", () => {
      // Create a snapshot at init completion
      const baseSnapshot: PipelineSnapshot = {
        runId: "run-1",
        status: "running",
        requirement: "test",
        lastCompletedStage: "init",
        lastCompletedStageIndex: 0,
        contextEntries: [],
        stageResults: [{ name: "init", durationMs: 50, status: "success" }],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: "stage:exit:123",
        error: null,
      };

      const newEvents: PipelineEvent[] = [
        createEvent("stage:exit", { stage: "context", durationMs: 100 }),
        createEvent("stage:exit", { stage: "plan", durationMs: 75 }),
      ];

      const state = reconstructor.reconstructFromSnapshot(
        createSnapshot(baseSnapshot),
        newEvents
      );

      expect(state.lastCompletedStage).toBe("plan");
      expect(state.stageResults).toHaveLength(3);
    });
  });
});

describe("createSnapshot", () => {
  it("creates Snapshot wrapper", () => {
    const state: PipelineSnapshot = {
      runId: "run-1",
      status: "running",
      requirement: "test",
      lastCompletedStage: "context",
      lastCompletedStageIndex: 1,
      contextEntries: [],
      stageResults: [],
      startedAt: 1000,
      lastEventAt: 2000,
      lastEventId: "event-1",
      error: null,
    };

    const snapshot = createSnapshot(state);

    expect(snapshot.id).toBe("snapshot:run-1:1");
    expect(snapshot.state).toBe(state);
    expect(snapshot.lastEventId).toBe("event-1");
  });
});
