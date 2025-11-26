process.env.OPENAI_API_KEY ??= "test-key";
process.env.DISABLE_TRPC_METRICS = "1";

import {
  afterEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { performance } from "node:perf_hooks";
import type { WorkflowEvent } from "@alfred/type";
import { toObservable } from "../../packages/api/test/utils/stream";
import { WorkflowTestHarness } from "../../packages/api/test/utils/workflow-server";
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

const { handleWorkflowStreamRequest } = await import(
  "../../apps/web/src/routes/api/workflow/stream"
);

const baseInput = {
  requirement: "Measure workflow latency",
  auto: "low" as const,
  mode: "sequential" as const,
};

const decoder = new TextDecoder();

describe("workflow stream latency", () => {
  afterEach(() => {
    orchestrateWorkflowStreamMock?.mockReset?.();
    enforceWorkflowPlanPolicyMock?.mockClear?.();
  });

  it("emits the first SSE workflow event under 100ms", async () => {
    mockImmediateWorkflow();
    const harness = new WorkflowTestHarness();

    const startedAt = performance.now();
    const response = await harness.invoke(handleWorkflowStreamRequest, baseInput);
    const latency = await readFirstWorkflowEventLatency(response, startedAt);

    console.info(
      `[latency] transport=sse first_event_ms=${latency.toFixed(2)}`
    );
    expect(latency).toBeLessThan(100);

    await harness.close();
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

function mockImmediateWorkflow(delayMs = 5) {
  if (useRealLatencyMode || !orchestrateWorkflowStreamMock) {
    return;
  }
  orchestrateWorkflowStreamMock.mockImplementation(
    async (_input, _session, callbacks) => {
      setTimeout(() => {
        const event: WorkflowEvent = {
          type: "notice",
          message: "workflow_started",
          eventId: "evt-perf",
        } as WorkflowEvent;
        callbacks.emitNext(event);
        callbacks.emitComplete();
      }, delayMs);
      return () => {};
    }
  );
}

async function readFirstWorkflowEventLatency(
  response: Response,
  startedAt: number
): Promise<number> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("sse response missing body");
  }
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      throw new Error("sse stream ended before workflow event");
    }
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const parsed = parseSseChunk(chunk);
      if (parsed && parsed.event === "workflow-event") {
        await reader.cancel();
        return performance.now() - startedAt;
      }
      idx = buffer.indexOf("\n\n");
    }
  }
}

type ParsedSseChunk = {
  event: string;
  data: string;
};

function parseSseChunk(chunk: string): ParsedSseChunk | null {
  let event = "message";
  let data = "";
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      const payload = line.slice("data:".length);
      data = data.length ? `${data}\n${payload}` : payload;
    }
  }
  if (!data) {
    return null;
  }
  return { event, data };
}
