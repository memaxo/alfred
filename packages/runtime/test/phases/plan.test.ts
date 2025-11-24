import { describe, expect, it, mock } from "bun:test";
import type {
  ContextBundle,
  SearchReceipt,
  WorkflowEvent,
} from "@alfred/type/plan";
import type { ExecutionContext } from "../../src/context";
import type { RuntimeInput } from "../../src/types";

const buildMock = mock<(input: unknown) => Promise<ExecutionContext>>();

mock.module("../../src/context", () => ({
  ContextBuilder: class {
    build = buildMock;
  },
}));

const persistExecPlansMock = mock(async () => {});
mock.module("@alfred/agent/assistant/graphstore", () => ({
  persistExecPlans: persistExecPlansMock,
}));

mock.module("@alfred/agent/orchestrator/multi/decompose", () => ({
  decomposeTask: () => [
    { id: "task-1", requirement: "do something" },
    { id: "task-2", requirement: "do more" },
  ],
}));

mock.module("@alfred/agent/orchestrator/multi/execplan", () => ({
  generateSubtaskExecPlanSkeleton: () => "# Task skeleton",
}));

const { RuntimeContext } = await import("@alfred/type/runtime-context");
const { executePlanPhase } = await import("../../src/phases/plan");
const { ScanPhase } = await import("../../src/pipeline/phases/scan");
const { PlanPhase } = await import("../../src/pipeline/phases/plan");

const baseInput: RuntimeInput = {
  requirement: "Implement cache",
  auto: "low",
  workspace: "/tmp/runtime",
};

function createExecutionContext(): ExecutionContext {
  const receipts: SearchReceipt = {
    code: [
      {
        id: "code:src/index.ts",
        kind: "code",
        path: "src/index.ts",
        score: 0.9,
      },
    ],
    created: new Date(),
  } as SearchReceipt;

  const bundle: ContextBundle = {
    maxTokens: 24000,
    estimatedTokens: 120,
    files: [
      {
        path: "src/index.ts",
        startLine: 1,
        endLine: 10,
        tokens: 50,
        content: "const value = 1;",
      },
    ],
  } as ContextBundle;

  return {
    requirement: baseInput.requirement,
    receipts,
    bundle,
    totalTokens: 120,
  } as ExecutionContext;
}

async function drain(generator: AsyncGenerator<WorkflowEvent, void, void>) {
  const events: WorkflowEvent[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

describe("executePlanPhase", () => {
  it("uses prebuilt context when provided", async () => {
    const prebuilt = createExecutionContext();
    buildMock.mockReset();

    const generator = executePlanPhase(
      baseInput,
      "run-prebuilt",
      new AbortController().signal,
      prebuilt
    );

    await drain(generator);

    expect(buildMock).not.toHaveBeenCalled();
  });

  it("builds context when not provided", async () => {
    const built = createExecutionContext();
    buildMock.mockReset();
    buildMock.mockImplementationOnce(async () => built);

    const generator = executePlanPhase(
      baseInput,
      "run-build",
      new AbortController().signal
    );

    await drain(generator);

    expect(buildMock).toHaveBeenCalledTimes(1);
  });

  it("pipeline scan→plan path reuses cached context", async () => {
    buildMock.mockReset();
    const built = createExecutionContext();
    buildMock.mockImplementation(async () => built);

    const input = { ...baseInput };
    const runtimeContext = new RuntimeContext([["scanContext", null]]);

    const scanPhase = new ScanPhase("run-pipeline");
    const planPhase = new PlanPhase("run-pipeline");

    const drainPhase = async (phase: any) => {
      const generator = phase.run(input, runtimeContext as any);
      for await (const _event of generator) {
        // ignore events for this test
      }
    };

    await drainPhase(scanPhase);
    expect(buildMock).toHaveBeenCalledTimes(1);

    await drainPhase(planPhase);
    expect(buildMock).toHaveBeenCalledTimes(1);
  });
});
