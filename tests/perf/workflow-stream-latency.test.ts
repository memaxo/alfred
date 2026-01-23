process.env.OPENAI_API_KEY ??= "test-key";
process.env.DISABLE_TRPC_METRICS = "1";

import { afterEach, describe, expect, it, mock, vi } from "bun:test";
import { performance } from "node:perf_hooks";
import { installPipelineMocks } from "../../packages/api/test/utils/pipeline";
import { toObservable } from "../../packages/api/test/utils/stream";
import { createWorkflowCaller } from "../../packages/api/test/utils/workflow-caller";

const useRealLatencyMode = process.env.WORKFLOW_LATENCY_MODE === "real";
if (useRealLatencyMode) {
  console.info("[latency] real mode enabled - using live orchestrator");
}

if (!useRealLatencyMode) {
  installPipelineMocks({
    dbRepo: true,
    sessionRecovery: true,
    linear: true,
    runtimeLinear: true,
    preferenceRefresh: true,
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
}

const baseInput = {
  requirement: "Measure workflow latency",
  auto: "low" as const,
  mode: "sequential" as const,
};

describe("workflow stream latency", () => {
  afterEach(() => {
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
