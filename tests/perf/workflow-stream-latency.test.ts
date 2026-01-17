process.env.OPENAI_API_KEY ??= "test-key";
process.env.DISABLE_TRPC_METRICS = "1";

import { afterEach, describe, expect, it, mock, vi } from "bun:test";
import { performance } from "node:perf_hooks";
import type { PipelineEvent } from "@alfred/pipeline";
import { toObservable } from "../../packages/api/test/utils/stream";
import { createWorkflowCaller } from "../../packages/api/test/utils/workflow-caller";

const useRealLatencyMode = process.env.WORKFLOW_LATENCY_MODE === "real";
if (useRealLatencyMode) {
  console.info("[latency] real mode enabled - using live orchestrator");
}

const pipelineRunnerMock = useRealLatencyMode ? null : vi.fn();
if (pipelineRunnerMock) {
  mock.module("@alfred/pipeline", () => {
    class PipelineRunner {
      private readonly observers = new Set<{
        onEvent: (event: PipelineEvent) => void;
        onComplete?: () => void;
      }>();

      addObserver(observer: { onEvent: (event: PipelineEvent) => void }) {
        this.observers.add(observer);
        return this;
      }

      async *run(input: {
        runId: string;
        requirement: string;
      }): AsyncGenerator<PipelineEvent, void, void> {
        const start: PipelineEvent = {
          type: "pipeline:start",
          runId: input.runId,
          requirement: input.requirement,
          timestamp: Date.now(),
        };
        for (const observer of this.observers) {
          observer.onEvent(start);
        }
        for (const observer of this.observers) {
          observer.onComplete?.();
        }
      }
    }

    return {
      PipelineRunner,
      registerDefaultStages: () => {},
    };
  });
}

const enforceWorkflowPlanPolicyMock = useRealLatencyMode
  ? null
  : vi.fn().mockResolvedValue({ obligations: [] as string[] });
if (enforceWorkflowPlanPolicyMock) {
  mock.module("@alfred/api/workflow/access", () => ({
    enforceWorkflowPlanPolicy: enforceWorkflowPlanPolicyMock,
  }));
}

if (!useRealLatencyMode) {
  mock.module("@alfred/api/preference/refresh", () => ({
    triggerPreferenceRefresh: vi.fn(),
  }));
  mock.module("@alfred/agent/workflow/session-recovery", () => ({
    registerRunHandle: async () => {},
    unregisterRunHandle: async () => {},
  }));
  mock.module("@alfred/agent/workflow/linear", () => ({
    ensureLinearTicket: async (params: { linear?: unknown }) => ({
      linear: params.linear,
      ticket: undefined,
    }),
  }));
  mock.module("@alfred/runtime/workflow/linear", () => ({
    bootstrapLinearSession: async () => {},
  }));
  mock.module("@alfred/db/repo/workflow", () => ({
    PostgresCheckpointStorage: class {
      async save() {}
      async load() {
        return null;
      }
      async delete() {}
    },
  }));
}

const baseInput = {
  requirement: "Measure workflow latency",
  auto: "low" as const,
  mode: "sequential" as const,
};

describe("workflow stream latency", () => {
  afterEach(() => {
    pipelineRunnerMock?.mockReset?.();
    enforceWorkflowPlanPolicyMock?.mockClear?.();
  });

  it("emits the first TRPC workflow event under 100ms", async () => {
    const caller = await createWorkflowCaller();
    const startedAt = performance.now();
    const observable = toObservable(await caller.streamPipeline(baseInput));
    const latency = await new Promise<number>((resolve, reject) => {
      observable.subscribe({
        next: () => resolve(performance.now() - startedAt),
        error: (err: unknown) =>
          reject(err instanceof Error ? err : new Error(String(err))),
        complete: () => reject(new Error("workflow stream completed early")),
      });
    });

    console.info(
      `[latency] transport=trpc first_event_ms=${latency.toFixed(2)}`
    );
    expect(latency).toBeLessThan(100);
  });
});
