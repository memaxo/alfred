import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { LanguageModel } from "ai";

const { createRuntime } = await import("../src/core");

const originalDisableCodex = process.env.RUNTIME_DISABLE_CODEX;
const originalTestOrch = process.env.RUNTIME_TEST_ORCHESTRATION;

// SKIP: These tests pass in isolation but fail when run with other tests due to
// Bun's mock.module() pollution from earlier test files affecting cognitive/workflow modules.
// TODO: Refactor to use dependency injection instead of mock.module()
describe.skip("WorkflowRuntime supervisor integration", () => {
  let mockModel: LanguageModel;
  const baseInput = {
    requirement: "supervisor integration check",
    auto: "low" as const,
    workspace: "/tmp/supervisor",
  };

  beforeEach(() => {
    mockModel = {} as LanguageModel;
  });

  afterAll(() => {
    if (originalDisableCodex === undefined) {
      process.env.RUNTIME_DISABLE_CODEX = undefined;
    } else {
      process.env.RUNTIME_DISABLE_CODEX = originalDisableCodex;
    }
    if (originalTestOrch === undefined) {
      process.env.RUNTIME_TEST_ORCHESTRATION = undefined;
    } else {
      process.env.RUNTIME_TEST_ORCHESTRATION = originalTestOrch;
    }
  });

  it("interrupts reasoning loops", async () => {
    const createAiAdapter = () => ({
      async *stream() {
        for (let i = 0; i < 6; i++) {
          yield { _: "reasoning", textDelta: "loop" } as WorkflowEvent;
        }
        yield { _: "finish", finishReason: "stop" } as WorkflowEvent;
      },
    });

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        createAiAdapter,
      });

      // LoopDetector uses exact_match for identical content
      await expect(consume(runtime)).rejects.toThrow(
        /workflow_interrupted:exact_match/
      );
    });
  });

  it("aborts when heartbeat stalls", async () => {
    const createAiAdapter = () => ({
      async *stream(options: { abortSignal?: AbortSignal }) {
        const signal = options.abortSignal;
        await new Promise<never>((_, reject) => {
          if (!signal) {
            reject(new Error("missing abort signal"));
            return;
          }
          const abortError =
            signal.reason instanceof Error
              ? signal.reason
              : new Error(String(signal.reason ?? "aborted"));
          if (signal.aborted) {
            reject(abortError);
            return;
          }
          signal.addEventListener("abort", () => reject(abortError), {
            once: true,
          });
        });
      },
    });

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        createAiAdapter,
        supervisorHeartbeatMs: 150,
        supervisorCheckIntervalMs: 20,
      });

      await expect(consume(runtime)).rejects.toThrow(
        /workflow_interrupted:process_heartbeat_failed/
      );
    });
  });

  it("detects low entropy (semantic loops)", async () => {
    // Test that repeated similar outputs trigger entropy detection
    const createAiAdapter = () => ({
      async *stream() {
        // Emit nearly identical reasoning traces
        for (let i = 0; i < 5; i++) {
          yield { _: "reasoning", textDelta: "loop" } as WorkflowEvent;
        }
        yield { _: "finish", finishReason: "stop" } as WorkflowEvent;
      },
    });

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        createAiAdapter,
      });

      // Should detect the repetitive pattern via exact_match (identical strings)
      await expect(consume(runtime)).rejects.toThrow(/exact_match/);
    });
  });

  it("detects zombie processes (no progress)", async () => {
    // Test that supervisor detects when process makes no progress
    let eventCount = 0;

    const createAiAdapter = () => ({
      async *stream(options: { abortSignal?: AbortSignal }) {
        const signal = options.abortSignal;

        // Emit one event then stall
        yield { _: "reasoning", textDelta: "loop" } as WorkflowEvent;
        eventCount++;

        // Wait indefinitely (simulating a zombie process)
        await new Promise<never>((_, reject) => {
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      },
    });

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        createAiAdapter,
        supervisorHeartbeatMs: 100,
        supervisorCheckIntervalMs: 20,
      });

      await expect(consume(runtime)).rejects.toThrow(/heartbeat_failed/);
      expect(eventCount).toBe(1);
    });
  });

  it("propagates interrupt event to cognitive state", async () => {
    // Test that interrupt events are properly typed and propagated
    const events: WorkflowEvent[] = [];

    const createAiAdapter = () => ({
      async *stream() {
        for (let i = 0; i < 6; i++) {
          const event = { _: "reasoning", textDelta: "loop" } as WorkflowEvent;
          events.push(event);
          yield event;
        }
        yield { _: "finish", finishReason: "stop" } as WorkflowEvent;
      },
    });

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        createAiAdapter,
      });

      try {
        await consume(runtime);
      } catch (error) {
        // Interrupt should have occurred
        expect(error).toBeDefined();
        const errorMsg = error instanceof Error ? error.message : String(error);
        expect(errorMsg).toContain("interrupt");
      }

      // Events should have been emitted before interrupt
      expect(events.length).toBeGreaterThan(0);
    });
  });

  it("verifies supervisor interrupt triggers cognitive loop", async () => {
    // Test that supervisor interrupt actually calls runCognitiveLoop and persists interrupt event
    const { cognitiveRepo } = await import("@alfred/db");
    const { randomUUID } = await import("node:crypto");
    const runId = randomUUID();

    const createAiAdapter = () => ({
      async *stream() {
        // Emit repeated identical reasoning to trigger loop detection
        for (let i = 0; i < 6; i++) {
          yield { _: "reasoning", textDelta: "loop" } as WorkflowEvent;
        }
        yield { _: "finish", finishReason: "stop" } as WorkflowEvent;
      },
    });

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        runId,
        createAiAdapter,
      });

      try {
        await consume(runtime);
        expect.fail("Should have thrown interrupt error");
      } catch (error) {
        // Verify error is interrupt-related
        const errorMsg = error instanceof Error ? error.message : String(error);
        expect(errorMsg).toContain("workflow_interrupted");

        // Wait a bit for async cognitive loop to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify interrupt event was persisted to cognitive events
        const cognitiveEvents = await cognitiveRepo.getAllEvents(runId);
        const interruptEvents = cognitiveEvents.filter(
          (e) => e.type === "interrupt"
        );

        // Should have at least one interrupt event from supervisor
        expect(interruptEvents.length).toBeGreaterThan(0);

        // Verify interrupt event has correct structure
        const interruptPayload = interruptEvents[0]?.payload;
        expect(interruptPayload).toBeDefined();
        if (
          interruptPayload &&
          typeof interruptPayload === "object" &&
          "data" in interruptPayload
        ) {
          const data = (interruptPayload as any).data;
          expect(data.reason).toBeDefined();
          expect(data.priority).toBe(2); // Supervisor interrupts use priority 2
        }
      }
    });
  });

  it("verifies heartbeat failure triggers cognitive loop", async () => {
    // Test that heartbeat timeout calls runCognitiveLoop and persists interrupt event
    const { cognitiveRepo } = await import("@alfred/db");
    const { randomUUID } = await import("node:crypto");
    const runId = randomUUID();

    const createAiAdapter = () => ({
      async *stream(options: { abortSignal?: AbortSignal }) {
        const signal = options.abortSignal;
        // Emit one event then stall (simulating zombie process)
        yield { _: "reasoning", textDelta: "loop" } as WorkflowEvent;

        // Wait indefinitely until aborted
        await new Promise<never>((_, reject) => {
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      },
    });

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        runId,
        createAiAdapter,
        supervisorHeartbeatMs: 100,
        supervisorCheckIntervalMs: 20,
      });

      try {
        await consume(runtime);
        expect.fail("Should have thrown heartbeat failure error");
      } catch (error) {
        // Verify error is heartbeat-related
        const errorMsg = error instanceof Error ? error.message : String(error);
        expect(errorMsg).toContain("heartbeat_failed");

        // Wait a bit for async cognitive loop to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify interrupt event was persisted to cognitive events
        const cognitiveEvents = await cognitiveRepo.getAllEvents(runId);
        const interruptEvents = cognitiveEvents.filter(
          (e) => e.type === "interrupt"
        );

        // Should have at least one interrupt event from supervisor
        expect(interruptEvents.length).toBeGreaterThan(0);

        // Verify interrupt event has heartbeat failure reason
        const interruptPayload = interruptEvents[0]?.payload;
        expect(interruptPayload).toBeDefined();
        if (
          interruptPayload &&
          typeof interruptPayload === "object" &&
          "data" in interruptPayload
        ) {
          const data = (interruptPayload as any).data;
          expect(data.reason).toContain("process_heartbeat_failed");
          expect(data.priority).toBe(2);
        }
      }
    });
  });

  it("handles multiple reasoning traces correctly", async () => {
    // Test that distinct reasoning traces don't trigger false positives
    const createAiAdapter = () => ({
      async *stream() {
        const distinctReasons = [
          "First: Analyzing user requirements",
          "Second: Designing architecture",
          "Third: Planning implementation",
          "Fourth: Considering edge cases",
          "Fifth: Finalizing approach",
        ];

        for (const text of distinctReasons) {
          yield { _: "reasoning", textDelta: text } as WorkflowEvent;
        }
        yield { _: "finish", finishReason: "stop" } as WorkflowEvent;
      },
    });

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        createAiAdapter,
      });

      // Should NOT throw - distinct reasoning traces should be allowed
      // (The test passes if no error is thrown)
      try {
        await consume(runtime);
      } catch (error) {
        // If it throws, make sure it's not a loop detection error
        const errorMsg = error instanceof Error ? error.message : String(error);
        expect(errorMsg).not.toContain("exact_match");
        expect(errorMsg).not.toContain("semantic_similarity");
      }
    });
  });

  it("respects supervisor check interval", async () => {
    let _checkCount = 0;
    const startTime = performance.now();

    const createAiAdapter = () => ({
      async *stream(options: { abortSignal?: AbortSignal }) {
        const signal = options.abortSignal;

        // Yield immediately to show progress
        yield { _: "reasoning", textDelta: "first" } as WorkflowEvent;

        // Count how many times the stream is accessed
        _checkCount++;

        // Yield another event quickly to show continuous progress
        yield { _: "reasoning", textDelta: "second" } as WorkflowEvent;

        // Very short wait to respect check interval
        await new Promise((resolve) => setTimeout(resolve, 10));

        if (signal?.aborted) {
          throw signal.reason;
        }

        yield { _: "reasoning", textDelta: "third" } as WorkflowEvent;
        yield { _: "finish", finishReason: "stop" } as WorkflowEvent;
      },
    });

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        createAiAdapter,
        supervisorCheckIntervalMs: 50,
        supervisorHeartbeatMs: 10_000, // Very long heartbeat to avoid premature interruption for this test
      });

      // The test verifies that with a short check interval, the supervisor doesn't interrupt
      // prematurely when the stream is making progress (yielding varied reasoning events)
      await consume(runtime);

      const duration = performance.now() - startTime;
      // Should complete in reasonable time without interruption
      expect(duration).toBeLessThan(1000);
    });
  });
});

async function consume(runtime: ReturnType<typeof createRuntime>) {
  for await (const _event of runtime.stream) {
    // Drain stream until it throws
  }
}

async function runWithExecutionEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prevDisable = process.env.RUNTIME_DISABLE_CODEX;
  const prevTestOrch = process.env.RUNTIME_TEST_ORCHESTRATION;
  process.env.RUNTIME_DISABLE_CODEX = "0";
  process.env.RUNTIME_TEST_ORCHESTRATION = "1";
  try {
    return await fn();
  } finally {
    if (prevDisable === undefined) {
      process.env.RUNTIME_DISABLE_CODEX = undefined;
    } else {
      process.env.RUNTIME_DISABLE_CODEX = prevDisable;
    }
    if (prevTestOrch === undefined) {
      process.env.RUNTIME_TEST_ORCHESTRATION = undefined;
    } else {
      process.env.RUNTIME_TEST_ORCHESTRATION = prevTestOrch;
    }
  }
}
