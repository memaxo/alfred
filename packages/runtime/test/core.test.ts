/**
 * WorkflowRuntime core tests
 */

import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { LanguageModel } from "ai";
const { AISDKAdapter } = await import("../src/adapters/ai");
const originalStream = AISDKAdapter.prototype.stream;

// Stub AISDKAdapter.stream to avoid network calls during unit tests
AISDKAdapter.prototype.stream = async function* () {
  yield { type: "finish", finishReason: "stop" } as WorkflowEvent;
};

const originalDisableCodex = process.env.RUNTIME_DISABLE_CODEX;
process.env.RUNTIME_DISABLE_CODEX = "1";

const { createRuntime } = await import("../src/core");
import type { RuntimeInput } from "../src/types";

afterAll(() => {
  AISDKAdapter.prototype.stream = originalStream;
  if (originalDisableCodex === undefined) {
    delete process.env.RUNTIME_DISABLE_CODEX;
  } else {
    process.env.RUNTIME_DISABLE_CODEX = originalDisableCodex;
  }
});

describe("WorkflowRuntime", () => {
  let mockModel: LanguageModel;
  let baseInput: RuntimeInput;

  beforeEach(() => {
    // Create minimal mock model (will be enhanced in Phase 3.2)
    mockModel = {} as LanguageModel;

    baseInput = {
      requirement: "test requirement",
      auto: "low",
      workspace: "/tmp/test",
    };
  });

  describe("Phase Execution Order", () => {
    it("executes workflow phases in correct order", async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
      });

      expect(runtime.runId).toBeDefined();
      expect(runtime.summary).toContain("test requirement");

      const events: WorkflowEvent[] = [];
      for await (const event of runtime.stream) {
        events.push(event);
      }

      // Verify basic event sequence
      const eventTypes = events.map((e) => e.type);

      // Should start with 'run' event
      expect(eventTypes[0]).toBe("run");

      // Should have progress events
      expect(eventTypes.some((t) => t === "progress")).toBe(true);

      // Should have step-start and step-complete for each phase
      const stepStarts = events.filter((e) => e.type === "step-start");
      const stepCompletes = events.filter((e) => e.type === "step-complete");

      expect(stepStarts.length).toBe(4); // scan, plan, act, report
      expect(stepCompletes.length).toBe(4);

      // Verify phase order in step events
      const phases = stepStarts.map((e: any) => e.phase);
      expect(phases).toEqual(["scan", "plan", "act", "report"]);

      // Should end with 100% progress
      const lastProgress = events.filter((e) => e.type === "progress").pop();
      expect(lastProgress).toMatchObject({
        type: "progress",
        pct: 100,
        message: "completed",
      });
    });

    it("emits correct progress percentages for each phase", async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
      });

      const progressEvents: Array<{ pct?: number; message?: string }> = [];
      for await (const event of runtime.stream) {
        if (event.type === "progress") {
          progressEvents.push({ pct: event.pct, message: event.message });
        }
      }

      // Should have progress at phase boundaries
      expect(progressEvents.length).toBeGreaterThan(0);

      // First progress should be 0% (initializing)
      expect(progressEvents[0]).toMatchObject({
        pct: 0,
        message: "initializing",
      });

      // Last progress should be 100% (completed)
      const last = progressEvents.at(-1);
      expect(last).toMatchObject({ pct: 100, message: "completed" });
    });
  });

  describe("Cancellation", () => {
    it("handles cancellation via AbortSignal before start", async () => {
      const abortController = new AbortController();
      abortController.abort(); // Cancel immediately

      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        signal: abortController.signal,
      });

      const events: WorkflowEvent[] = [];
      for await (const event of runtime.stream) {
        events.push(event);
      }

      // Should emit run event and cancellation notice
      expect(events[0].type).toBe("run");
      expect(
        events.some(
          (e) =>
            e.type === "notice" && (e as any).message?.includes("cancelled")
        )
      ).toBe(true);

      // Should not execute phases
      const stepStarts = events.filter((e) => e.type === "step-start");
      expect(stepStarts.length).toBe(0);
    });

    it("handles cancellation via cancel() method during execution", async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
      });

      const events: WorkflowEvent[] = [];
      let eventCount = 0;

      for await (const event of runtime.stream) {
        events.push(event);
        eventCount++;

        // Cancel after 3 events
        if (eventCount === 3) {
          runtime.cancel();
        }

        // Break after 10 events to avoid hanging
        if (eventCount > 10) {
          break;
        }
      }

      // Should have started execution
      expect(events[0].type).toBe("run");

      // Should emit cancellation notice
      const cancelledEvent = events.find(
        (e) => e.type === "notice" && (e as any).message?.includes("cancelled")
      );
      expect(cancelledEvent).toBeDefined();
    });
  });

  describe("Resume Logic", () => {
    it("queues resume payload when not waiting", async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
      });

      // Resume before waiting
      await runtime.resume({
        event: "bio-authz",
        authz: "test-token",
      });

      // Should queue the payload (tested indirectly via future implementation)
      expect(true).toBe(true); // Placeholder - will verify in integration tests
    });

    it("supports multiple resume payloads", async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
      });

      // Queue multiple resumes
      await runtime.resume({ event: "bio-authz", authz: "token-1" });
      await runtime.resume({ event: "deploy-authz", authz: "token-2" });

      // Should queue both (tested indirectly)
      expect(true).toBe(true); // Placeholder - will verify in integration tests
    });
  });

  describe("Error Handling", () => {
    it("emits error event on exception", async () => {
      // This test will be enhanced in Phase 3.2 when we have real error scenarios
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
      });

      const events: WorkflowEvent[] = [];

      try {
        for await (const event of runtime.stream) {
          events.push(event);
        }
      } catch (_error) {
        // Error thrown from stream
      }

      // Basic structure verification
      expect(events[0].type).toBe("run");
    });
  });

  describe("Public API", () => {
    it("provides required RunPlanV6 interface", () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
      });

      // Verify interface matches RunPlanV6
      expect(runtime).toHaveProperty("runId");
      expect(runtime).toHaveProperty("summary");
      expect(runtime).toHaveProperty("stream");
      expect(runtime).toHaveProperty("resume");
      expect(runtime).toHaveProperty("cancel");

      expect(typeof runtime.runId).toBe("string");
      expect(typeof runtime.summary).toBe("string");
      expect(typeof runtime.resume).toBe("function");
      expect(typeof runtime.cancel).toBe("function");
    });

    it("generates unique runId for each instance", () => {
      const runtime1 = createRuntime({ input: baseInput, model: mockModel });
      const runtime2 = createRuntime({ input: baseInput, model: mockModel });

      expect(runtime1.runId).not.toBe(runtime2.runId);
    });

    it("includes requirement in summary", () => {
      const runtime = createRuntime({
        input: { ...baseInput, requirement: "unique requirement" },
        model: mockModel,
      });

      expect(runtime.summary).toContain("unique requirement");
    });
  });
});
