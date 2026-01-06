process.env.OPENAI_API_KEY ??= "test-key";
process.env.DISABLE_TRPC_METRICS = "1";

import { afterEach, describe, expect, it, mock, vi } from "bun:test";
import { performance } from "node:perf_hooks";
import { toObservable } from "../../packages/api/test/utils/stream";
import { createWorkflowCaller } from "../../packages/api/test/utils/workflow-caller";

const useRealLatencyMode = process.env.WORKFLOW_LATENCY_MODE === "real";
if (useRealLatencyMode) {
  console.info("[latency] real mode enabled - using live orchestrator");
}

const orchestrateWorkflowStreamMock = useRealLatencyMode ? null : vi.fn();
if (orchestrateWorkflowStreamMock) {
  mock.module("@alfred/agent/workflow/orchestrator", () => ({
    orchestrateWorkflowStream: orchestrateWorkflowStreamMock,
  }));
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
}

const baseInput = {
  requirement: "Measure workflow latency",
  auto: "low" as const,
  mode: "sequential" as const,
};

describe("workflow stream latency", () => {
  afterEach(() => {
    orchestrateWorkflowStreamMock?.mockReset?.();
    enforceWorkflowPlanPolicyMock?.mockClear?.();
  });

  it("emits the first TRPC workflow event under 100ms", async () => {
    mockImmediateWorkflow();

    const caller = await createWorkflowCaller();
    const startedAt = performance.now();
    const observable = toObservable(await caller.stream(baseInput));
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

function mockImmediateWorkflow(_delayMs = 0) {
  if (orchestrateWorkflowStreamMock) {
    orchestrateWorkflowStreamMock.mockImplementation(() => {
      const response = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              `data: ${JSON.stringify({ type: "turn_started", id: "1" })}\n\n`
            );
            controller.close();
          },
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "x-vercel-ai-data-stream": "v1",
          },
        }
      );
      return response as unknown;
    });
  }
}
