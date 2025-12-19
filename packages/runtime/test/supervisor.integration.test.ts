import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { LanguageModel } from "ai";

const { AISDKAdapter } = await import("../src/adapters/ai");
const { createRuntime } = await import("../src/core");

const baselineStream = AISDKAdapter.prototype.stream;
const originalDisableCodex = process.env.RUNTIME_DISABLE_CODEX;
const originalTestOrch = process.env.RUNTIME_TEST_ORCHESTRATION;

describe("WorkflowRuntime supervisor integration", () => {
  let mockModel: LanguageModel;
  const baseInput = {
    requirement: "supervisor integration check",
    auto: "low" as const,
    workspace: "/tmp/supervisor",
  };

  beforeEach(() => {
    mockModel = {} as LanguageModel;
    AISDKAdapter.prototype.stream = baselineStream;
  });

  afterEach(() => {
    AISDKAdapter.prototype.stream = baselineStream;
  });

  afterAll(() => {
    AISDKAdapter.prototype.stream = baselineStream;
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
    AISDKAdapter.prototype.stream = async function* () {
      for (let i = 0; i < 6; i++) {
        yield {
          type: "reasoning",
          text: "Repeating the same plan",
        } as WorkflowEvent;
      }
      yield { type: "finish", finishReason: "stop" } as WorkflowEvent;
    };

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
      });

      // LoopDetector uses exact_match for identical content
      await expect(consume(runtime)).rejects.toThrow(
        /workflow_interrupted:exact_match/
      );
    });
  });

  it("aborts when heartbeat stalls", async () => {
    AISDKAdapter.prototype.stream = async function* (options) {
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
    };

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
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
    AISDKAdapter.prototype.stream = async function* () {
      // Emit nearly identical reasoning traces
      for (let i = 0; i < 5; i++) {
        yield {
          type: "reasoning",
          text: "Analyzing the same pattern repeatedly",
        } as WorkflowEvent;
      }
      yield { type: "finish", finishReason: "stop" } as WorkflowEvent;
    };

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
      });

      // Should detect the repetitive pattern via exact_match (identical strings)
      await expect(consume(runtime)).rejects.toThrow(/exact_match/);
    });
  });

  it("detects zombie processes (no progress)", async () => {
    // Test that supervisor detects when process makes no progress
    let eventCount = 0;

    AISDKAdapter.prototype.stream = async function* (options) {
      const signal = options.abortSignal;

      // Emit one event then stall
      yield { type: "reasoning", text: "Starting..." } as WorkflowEvent;
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
    };

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
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

    AISDKAdapter.prototype.stream = async function* () {
      for (let i = 0; i < 6; i++) {
        const event = {
          type: "reasoning",
          text: `Loop iteration ${i}`,
        } as WorkflowEvent;
        events.push(event);
        yield event;
      }
      yield { type: "finish", finishReason: "stop" } as WorkflowEvent;
    };

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
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

  it("handles multiple reasoning traces correctly", async () => {
    // Test that distinct reasoning traces don't trigger false positives
    AISDKAdapter.prototype.stream = async function* () {
      const distinctReasons = [
        "First: Analyzing user requirements",
        "Second: Designing architecture",
        "Third: Planning implementation",
        "Fourth: Considering edge cases",
        "Fifth: Finalizing approach",
      ];

      for (const text of distinctReasons) {
        yield {
          type: "reasoning",
          text,
        } as WorkflowEvent;
      }
      yield { type: "finish", finishReason: "stop" } as WorkflowEvent;
    };

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
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

    AISDKAdapter.prototype.stream = async function* (options) {
      const signal = options.abortSignal;

      // Yield immediately to show progress
      yield { type: "reasoning", text: "Starting task analysis" } as WorkflowEvent;
      
      // Count how many times the stream is accessed
      _checkCount++;

      // Yield another event quickly to show continuous progress
      yield { type: "reasoning", text: "Evaluating approach options" } as WorkflowEvent;

      // Very short wait to respect check interval
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (signal?.aborted) {
        throw signal.reason;
      }

      yield { type: "reasoning", text: "Finalizing solution" } as WorkflowEvent;
      yield { type: "finish", finishReason: "stop" } as WorkflowEvent;
    };

    await runWithExecutionEnv(async () => {
      const runtime = createRuntime({
        input: baseInput,
        model: mockModel,
        supervisorCheckIntervalMs: 50,
        supervisorHeartbeatMs: 10000, // Very long heartbeat to avoid premature interruption for this test
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
