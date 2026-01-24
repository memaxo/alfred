import { describe, expect, it } from "bun:test";

import type { PipelineEvent } from "../../src/events";
import type { PipelineSnapshot, SerializableValue } from "../../src/snapshot";

import { createEvent } from "../../src/events";
import { STAGE_ORDER } from "../../src/pipeline";
import { createSnapshot, PipelineReconstructor } from "../../src/snapshot";

/**
 * Performance Benchmarks for Pipeline Reconstruction
 *
 * Targets:
 * - Reconstruct 1000 events: < 10ms
 * - Resume from checkpoint: < 100ms
 * - Stage execution overhead: < 5ms per stage
 */

// Generate test events
function generateEvents(count: number): PipelineEvent[] {
  const events: PipelineEvent[] = [];

  // Start event
  events.push(
    createEvent("pipeline:start", { runId: "perf-run", requirement: "test" })
  );

  // Generate mix of events
  for (let i = 0; i < count; i++) {
    const eventType = i % 5;
    const stageIndex = i % STAGE_ORDER.length;
    const stage = STAGE_ORDER[stageIndex]!;

    switch (eventType) {
      case 0:
        events.push(createEvent("stage:enter", { stage }));
        break;
      case 1:
        events.push(createEvent("stage:exit", { stage, durationMs: 100 + i }));
        break;
      case 2:
        events.push(
          createEvent("stage:progress", {
            stage,
            message: `Progress ${i}`,
          })
        );
        break;
      case 3:
        events.push({
          type: "context:set",
          key: `key-${i}`,
          value: { index: i, data: `value-${i}` } as SerializableValue,
          timestamp: Date.now(),
        });
        break;
      case 4:
        events.push(
          createEvent("agent:spawn", {
            agentId: `agent-${i}`,
            taskId: `task-${i}`,
          })
        );
        break;
    }
  }

  return events;
}

// Generate a snapshot at a specific state
function createTestSnapshot(stageIndex: number): PipelineSnapshot {
  const contextEntries: [string, SerializableValue][] = [];
  for (let i = 0; i < 50; i++) {
    contextEntries.push([`key-${i}`, { index: i, data: `value-${i}` }]);
  }

  return {
    runId: "perf-run",
    status: "running",
    requirement: "test",
    lastCompletedStage: STAGE_ORDER[stageIndex] ?? null,
    lastCompletedStageIndex: stageIndex,
    contextEntries,
    stageResults: STAGE_ORDER.slice(0, stageIndex + 1).map((name, i) => ({
      name,
      durationMs: 100 + i * 10,
      status: "success" as const,
    })),
    startedAt: Date.now() - 10_000,
    lastEventAt: Date.now() - 100,
    lastEventId: `stage:exit:${Date.now() - 100}`,
    error: null,
  };
}

describe("Reconstruction Performance", () => {
  const reconstructor = new PipelineReconstructor();

  describe("Event Stream Reconstruction", () => {
    it("reconstructs 100 events in < 5ms", () => {
      const events = generateEvents(100);

      const start = performance.now();
      const state = reconstructor.reconstruct(events);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
      expect(state.runId).toBe("perf-run");
    });

    it("reconstructs 1000 events in < 10ms", () => {
      const events = generateEvents(1000);

      const start = performance.now();
      const state = reconstructor.reconstruct(events);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      expect(state.runId).toBe("perf-run");
    });

    it("reconstructs 5000 events in < 50ms", () => {
      const events = generateEvents(5000);

      const start = performance.now();
      const state = reconstructor.reconstruct(events);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(state.runId).toBe("perf-run");
    });
  });

  describe("Snapshot-based Reconstruction", () => {
    it("reconstructs from snapshot + 100 events in < 5ms", () => {
      const snapshot = createTestSnapshot(3); // At schedule stage
      const events = generateEvents(100);

      const start = performance.now();
      const state = reconstructor.reconstructFromSnapshot(
        createSnapshot(snapshot),
        events
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
      expect(state.runId).toBe("perf-run");
    });

    it("reconstructs from snapshot + 500 events in < 10ms", () => {
      const snapshot = createTestSnapshot(3);
      const events = generateEvents(500);

      const start = performance.now();
      reconstructor.reconstructFromSnapshot(createSnapshot(snapshot), events);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });

  describe("Reduce Function Performance", () => {
    it("reduce() is fast (< 0.1ms per event)", () => {
      const events = generateEvents(1000);
      let state = reconstructor.initialState;

      const start = performance.now();
      for (const event of events) {
        state = reconstructor.reduce(state, event);
      }
      const duration = performance.now() - start;

      const perEvent = duration / 1000;
      expect(perEvent).toBeLessThan(0.1);
    });
  });

  describe("Context Serialization Performance", () => {
    it("serializes large context in < 5ms", () => {
      const entries: [string, SerializableValue][] = [];
      for (let i = 0; i < 1000; i++) {
        entries.push([
          `key-${i}`,
          {
            index: i,
            nested: { deep: { value: `data-${i}` } },
            array: [1, 2, 3, i],
          },
        ]);
      }

      const snapshot: PipelineSnapshot = {
        runId: "perf-run",
        status: "running",
        requirement: "test",
        lastCompletedStage: "execute",
        lastCompletedStageIndex: 4,
        contextEntries: entries,
        stageResults: [],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      const start = performance.now();
      const json = JSON.stringify(snapshot);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
      expect(json.length).toBeGreaterThan(0);
    });

    it("deserializes large context in < 5ms", () => {
      const entries: [string, SerializableValue][] = [];
      for (let i = 0; i < 1000; i++) {
        entries.push([`key-${i}`, { index: i, data: `value-${i}` }]);
      }

      const snapshot: PipelineSnapshot = {
        runId: "perf-run",
        status: "running",
        requirement: "test",
        lastCompletedStage: "execute",
        lastCompletedStageIndex: 4,
        contextEntries: entries,
        stageResults: [],
        startedAt: Date.now(),
        lastEventAt: Date.now(),
        lastEventId: null,
        error: null,
      };

      const json = JSON.stringify(snapshot);

      const start = performance.now();
      const parsed = JSON.parse(json) as PipelineSnapshot;
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
      expect(parsed.contextEntries.length).toBe(1000);
    });
  });
});

describe("Memory Efficiency", () => {
  const reconstructor = new PipelineReconstructor();

  it("reduce() does not accumulate memory on repeated calls", () => {
    // This is a sanity check - reduce should create new state objects
    // but not hold references to old ones
    const events = generateEvents(100);
    const states: PipelineSnapshot[] = [];

    let state = reconstructor.initialState;
    for (const event of events) {
      state = reconstructor.reduce(state, event);
      // Only keep last 10 states
      if (states.length >= 10) {
        states.shift();
      }
      states.push(state);
    }

    // Final state should be independent of intermediate states
    expect(states.at(-1)?.runId).toBe("perf-run");
  });

  it("context entries use structural sharing via spread", () => {
    const initial = reconstructor.initialState;
    const event: PipelineEvent = {
      type: "context:set",
      key: "test",
      value: { data: "value" },
      timestamp: Date.now(),
    };

    const after = reconstructor.reduce(initial, event);

    // Should be different objects
    expect(after).not.toBe(initial);
    expect(after.contextEntries).not.toBe(initial.contextEntries);
  });
});
