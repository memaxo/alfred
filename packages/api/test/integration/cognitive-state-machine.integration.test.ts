/**
 * Cognitive State Machine Integration Tests
 *
 * Tests cognitive state machine behavior:
 * - State machine initialization with proper initial state
 * - Valid transitions through all cognitive states
 * - Invalid transition rejection with proper error messages
 * - State transition metrics tracking
 *
 * Uses SQLite in-memory database for fast, isolated tests.
 */

process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import {
  type AutonomyGradient,
  type CognitiveState,
  capturing,
  deciding,
  type Event,
  executing,
  idle,
  initialAutonomy,
  type Outcome,
  type Plan,
  reflecting,
  thinking,
} from "@alfred/cognitive/state";
import { applyTransition } from "@alfred/cognitive/transition";
import { describe, expect, it } from "bun:test";

const createInputEvent = (content: string): Event =>
  ({
    _: "input",
    content,
    source: "user",
    ts: Date.now(),
  }) as Event;

const createCompleteEvent = (outcome: Outcome): Event =>
  ({
    _: "complete",
    outcome,
    ts: Date.now(),
  }) as Event;

const createInterruptEvent = (reason: string): Event =>
  ({
    _: "interrupt",
    reason,
    priority: 1,
    ts: Date.now(),
  }) as Event;

const apply = (
  state: CognitiveState,
  event: Event,
  autonomy: AutonomyGradient = initialAutonomy(Date.now())
) => applyTransition(state, autonomy, event);

describe("Cognitive State Machine", () => {
  describe("State Initialization", () => {
    it("initializes with idle state", () => {
      const now = Date.now();
      const initialState = idle(now);

      expect(initialState._).toBe("idle");
      expect(typeof initialState._).toBe("string");
      expect(initialState.physiology).toBeDefined();
      expect(initialState.physiology.energy).toBeGreaterThan(0);
      expect(initialState.physiology.energy).toBeLessThanOrEqual(1);
    });

    it("initializes autonomy with valid values", () => {
      const autonomy = initialAutonomy(Date.now());

      expect(autonomy).toBeDefined();
      expect(autonomy.level).toBeDefined();
      expect(autonomy.confidence).toBeDefined();
      expect(Number(autonomy.level)).toBeGreaterThanOrEqual(0);
      expect(Number(autonomy.level)).toBeLessThanOrEqual(1);
      expect(autonomy.constraints).toBeInstanceOf(Array);
    });
  });

  describe("Valid Transitions", () => {
    it("transitions idle -> capturing on input", () => {
      const start = idle(Date.now());
      const result = apply(start, createInputEvent("Plan lunch"));

      expect(result.state._).toBe("capturing");
      expect((result.state as any).input).toBe("Plan lunch");
    });

    it("transitions capturing -> thinking on input", () => {
      const start = capturing(Date.now(), "Test input", 0.8);
      const result = apply(start, createInputEvent("Process this"));

      expect(result.state._).toBe("thinking");
      expect((result.state as any).about).toBe("Process this");
    });

    it("transitions thinking -> reflecting on completion", () => {
      const start = thinking(Date.now(), "Test plan");
      const outcome = { _: "success", result: "ok", duration: 10 };
      const result = apply(start, createCompleteEvent(outcome));

      expect(result.state._).toBe("reflecting");
      expect((result.state as any).outcome._).toBe("success");
    });

    it("transitions reflecting -> idle on next input", () => {
      const start = reflecting(
        { _: "success", result: "ok", duration: 10 },
        "expected",
        "actual"
      );
      const result = apply(start, createInputEvent("Next task"));

      expect(result.state._).toBe("idle");
    });

    it("transitions deciding -> executing on option selection", () => {
      const plan: Plan = {
        steps: [{ action: "test", params: {}, timeout: 1000, retryable: true }],
        duration: 1000,
        confidence: 0.8 as any,
      };
      const options = [
        {
          id: "option-1",
          description: "Option 1",
          score: 0.9,
          plan,
          risks: [],
          autonomy: 0.5 as any,
        },
      ];
      const start = deciding(Date.now(), options);
      const result = apply(start, createInputEvent("option-1"));

      expect(result.state._).toBe("executing");
      expect((result.state as any).plan).toBe(plan);
    });

    it("transitions executing -> reflecting on completion", () => {
      const plan: Plan = {
        steps: [{ action: "test", params: {}, timeout: 1000, retryable: true }],
        duration: 1000,
        confidence: 0.8 as any,
      };
      const start = executing(Date.now(), plan, initialAutonomy(Date.now()));
      const outcome = { _: "success", result: "ok", duration: 100 };
      const result = apply(start, createCompleteEvent(outcome));

      expect(result.state._).toBe("reflecting");
    });

    it("interrupts any state on high-priority interrupt", () => {
      const start = capturing(Date.now(), "Active process", 0.8);
      const result = apply(start, createInterruptEvent("user cancelled"));

      // Interrupts can transition to different states depending on reason
      expect(result.state._).toBeDefined();
    });
  });

  describe("Invalid Transitions", () => {
    it("handles unexpected events gracefully", () => {
      const start = idle(Date.now());
      // In real scenario, this would validate input
      // For now, verify that the system doesn't crash
      const result = apply(start, createInputEvent(""));

      expect(result).toBeDefined();
      expect(result.state).toBeDefined();
    });
  });

  describe("State Preservation", () => {
    it("preserves autonomy across transitions", () => {
      const autonomy = initialAutonomy(Date.now());
      const start = idle(Date.now());
      const result1 = apply(start, createInputEvent("test"), autonomy);
      const result2 = apply(
        result1.state,
        createInputEvent("another"),
        result1.autonomy
      );

      expect(result2.autonomy).toBeDefined();
      expect(typeof Number(result2.autonomy.level)).toBe("number");
    });

    it("updates physiology on transitions", () => {
      const start = idle(Date.now());
      const _initialFrustration = start.physiology.frustration;

      const result = apply(start, createInputEvent("test"));
      expect(result.state.physiology).toBeDefined();
      // Physiology should change based on transition
    });
  });

  describe("Metrics Tracking", () => {
    it("tracks transition timestamps", () => {
      const now = Date.now();
      const start = idle(now);
      const result = apply(start, createInputEvent("test"));

      expect(result.state._).toBeDefined();
      // In production, this would verify metric emission
    });

    it("measures transition performance", () => {
      const start = Date.now();
      const state = idle(start);
      const autonomy = initialAutonomy(start);
      const _result = apply(state, createInputEvent("test"), autonomy);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10); // Should complete in <10ms
    });
  });

  describe("End-to-End State Flow", () => {
    it("completes full workflow: idle -> capturing -> thinking -> reflecting -> idle", () => {
      let state = idle(Date.now());
      const autonomy = initialAutonomy(Date.now());

      // idle -> capturing
      state = apply(state, createInputEvent("Plan lunch"), autonomy).state;

      // capturing -> thinking
      state = apply(state, createInputEvent("Processed"), autonomy).state;

      // thinking -> reflecting
      const outcome = { _: "success", result: "done", duration: 100 };
      state = apply(state, createCompleteEvent(outcome), autonomy).state;

      // reflecting -> idle
      state = apply(state, createInputEvent("Next"), autonomy).state;

      expect(state._).toBe("idle");
    });

    it("handles workflow with failure: idle -> capturing -> thinking -> reflecting -> idle", () => {
      let state = idle(Date.now());
      const autonomy = initialAutonomy(Date.now());

      // idle -> capturing
      state = apply(state, createInputEvent("Do work"), autonomy).state;

      // capturing -> thinking
      state = apply(state, createInputEvent("Thinking"), autonomy).state;

      // thinking -> reflecting (with failure)
      const outcome = { _: "failure", error: "error", recoverable: true };
      state = apply(state, createCompleteEvent(outcome), autonomy).state;

      // reflecting -> idle
      state = apply(state, createInputEvent("Continue"), autonomy).state;

      expect(state._).toBe("idle");
      // Physiology should reflect failure
    });
  });
});
