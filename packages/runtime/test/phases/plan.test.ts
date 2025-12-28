import { beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  ContextBundle,
  SearchReceipt,
  WorkflowEvent,
} from "@alfred/type/plan";
import type { ExecutionContext } from "../../src/context";
import { executePlanPhase } from "../../src/phases/plan";
import type { RuntimeInput } from "../../src/types";

const persistExecPlansMock = mock(async () => {});
const buildContextMock = mock(async () => createExecutionContext());
const decomposeTaskMock = mock(() => [
  { id: "task-1", title: "task-1", requirement: "do something" },
  { id: "task-2", title: "task-2", requirement: "do more" },
]);
const generateSubtaskExecPlanSkeletonMock = mock(() => "# Task skeleton");

const streamMock = mock(async function* () {
  yield { _: "text-delta", id: "text-1", delta: "Plan step" } as WorkflowEvent;
  yield { _: "finish", finishReason: "stop" } as WorkflowEvent;
});

function createAiAdapter() {
  return { stream: streamMock } as any;
}

const baseInput: RuntimeInput = {
  requirement: "Implement cache",
  auto: "low",
  workspace: "/tmp/runtime",
};

beforeEach(() => {
  streamMock.mockReset();
  streamMock.mockImplementation(() =>
    (async function* () {
      yield {
        _: "text-delta",
        id: "text-1",
        delta: "Plan step",
      } as WorkflowEvent;
      yield { _: "finish", finishReason: "stop" } as WorkflowEvent;
    })()
  );
});

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
    maxTokens: 24_000,
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

async function drain(
  generator: AsyncGenerator<WorkflowEvent, string | null, void>
) {
  const events: WorkflowEvent[] = [];
  let summary: string | null | undefined;
  const iter = generator[Symbol.asyncIterator]();
  while (true) {
    const next = await iter.next();
    if (next.done) {
      summary = next.value ?? null;
      break;
    }
    events.push(next.value);
  }
  return { events, summary };
}

describe("executePlanPhase", () => {
  beforeEach(() => {
    streamMock.mockClear();
    buildContextMock.mockReset();
    persistExecPlansMock.mockReset();
    decomposeTaskMock.mockReset();
    generateSubtaskExecPlanSkeletonMock.mockReset();

    buildContextMock.mockImplementation(async () => createExecutionContext());
    persistExecPlansMock.mockImplementation(async () => {});
    decomposeTaskMock.mockImplementation(() => [
      { id: "task-1", title: "task-1", requirement: "do something" },
      { id: "task-2", title: "task-2", requirement: "do more" },
    ]);
    generateSubtaskExecPlanSkeletonMock.mockImplementation(
      () => "# Task skeleton"
    );
  });
  it("uses prebuilt context when provided", async () => {
    const prebuilt = createExecutionContext();

    const generator = executePlanPhase(
      baseInput,
      "run-prebuilt",
      new AbortController().signal,
      "test-model" as any,
      prebuilt,
      {
        createAiAdapter: () => createAiAdapter(),
        buildContext: buildContextMock as any,
        decomposeTask: decomposeTaskMock as any,
        generateSubtaskExecPlanSkeleton:
          generateSubtaskExecPlanSkeletonMock as any,
        persistExecPlans: persistExecPlansMock as any,
      }
    );

    const { summary } = await drain(generator);

    expect(buildContextMock).not.toHaveBeenCalled();
    expect(summary).toBe("Plan step");
  });

  it("builds context when not provided", async () => {
    const built = createExecutionContext();
    buildContextMock.mockImplementationOnce(async () => built);

    const generator = executePlanPhase(
      baseInput,
      "run-build",
      new AbortController().signal,
      "test-model" as any,
      null,
      {
        createAiAdapter: () => createAiAdapter(),
        buildContext: buildContextMock as any,
        decomposeTask: decomposeTaskMock as any,
        generateSubtaskExecPlanSkeleton:
          generateSubtaskExecPlanSkeletonMock as any,
        persistExecPlans: persistExecPlansMock as any,
      }
    );

    const { summary } = await drain(generator);

    expect(buildContextMock).toHaveBeenCalledTimes(1);
    expect(summary).toBe("Plan step");
  });
});
