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
      delete process.env.RUNTIME_DISABLE_CODEX;
    } else {
      process.env.RUNTIME_DISABLE_CODEX = originalDisableCodex;
    }
    if (originalTestOrch === undefined) {
      delete process.env.RUNTIME_TEST_ORCHESTRATION;
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

      await expect(consume(runtime)).rejects.toThrow(
        /workflow_interrupted:boredom_loop_detected/
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
      delete process.env.RUNTIME_DISABLE_CODEX;
    } else {
      process.env.RUNTIME_DISABLE_CODEX = prevDisable;
    }
    if (prevTestOrch === undefined) {
      delete process.env.RUNTIME_TEST_ORCHESTRATION;
    } else {
      process.env.RUNTIME_TEST_ORCHESTRATION = prevTestOrch;
    }
  }
}
