import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { ExecutionContext } from "../../src/context";
import type { RuntimeInput } from "../../src/types";

let orchestratorCallCount = 0;
async function* runOrchestratorMock(
  _input?: RuntimeInput,
  _runId?: string,
  _signal?: AbortSignal
) {
  orchestratorCallCount += 1;
  yield { type: "notice", message: "orchestrator" } as WorkflowEvent;
}

const buildToolsMock = mock(() => ({
  echo: {
    name: "echo",
    async execute(input: unknown) {
      return input;
    },
  },
}));

let streamCallCount = 0;
const streamMock = () => {
  streamCallCount += 1;
  return (async function* () {
    yield { type: "text-delta", delta: "Work" } as WorkflowEvent;
    yield { type: "tool-call", toolName: "echo", toolCallId: "1", input: { msg: "hi" } } as any;
    yield { type: "tool-result", toolName: "echo", toolCallId: "1", output: { msg: "hi" } } as any;
  })();
};

function createDeps() {
  return {
    createAiAdapter: () => ({
      stream: (..._args: unknown[]) => streamMock(),
    }) as any,
    buildToolset: buildToolsMock,
    runOrchestratorFn: runOrchestratorMock as any,
  };
}

const { executeActPhase } = await import("../../src/phases/act");

async function drain(
  generator: AsyncGenerator<WorkflowEvent, { escalated: boolean; reason?: string }, void>
) {
  const events: WorkflowEvent[] = [];
  const iter = generator[Symbol.asyncIterator]();
  let result: { escalated: boolean; reason?: string } | undefined;
  while (true) {
    const next = await iter.next();
    if (next.done) {
      result = next.value;
      break;
    }
    events.push(next.value);
  }
  return { events, result };
}

const baseInput: RuntimeInput = {
  requirement: "Build feature",
  auto: "low",
};

const sampleContext: ExecutionContext = {
  requirement: baseInput.requirement,
  receipts: { code: [], created: new Date() },
  bundle: null,
  totalTokens: 0,
};

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: "test", RUNTIME_TEST_ORCHESTRATION: "1" };
  buildToolsMock.mockReset();
  streamCallCount = 0;
  orchestratorCallCount = 0;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("executeActPhase", () => {
  it("streams AI execution with tools in sequential mode", async () => {
    const generator = executeActPhase(
      baseInput,
      "run-seq",
      new AbortController().signal,
      "test-model",
      undefined,
      undefined,
      undefined,
      sampleContext,
      "Summary",
      createDeps()
    );

    const { events, result } = await drain(generator);

    expect(orchestratorCallCount).toBe(0);
    expect(streamCallCount).toBe(1);
    expect(events.some((event) => event.type === "text-delta")).toBe(true);
    expect(result?.escalated).toBe(false);
  });

  it("delegates to orchestrator in parallel mode", async () => {
    const generator = executeActPhase(
      { ...baseInput, mode: "parallel" },
      "run-parallel",
      new AbortController().signal,
      "test-model",
      undefined,
      undefined,
      undefined,
      null,
      null,
      createDeps()
    );

    await drain(generator);

    expect(orchestratorCallCount).toBe(1);
    expect(streamCallCount).toBe(0);
  });

  it("emits placeholder when agents disabled", async () => {
    process.env.RUNTIME_TEST_ORCHESTRATION = "0";

    const generator = executeActPhase(
      baseInput,
      "run-placeholder",
      new AbortController().signal,
      "test-model",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      createDeps()
    );

    const { events } = await drain(generator);
    expect(events.find((event) => event.type === "notice" && (event as any).message === "execution_placeholder")).toBeDefined();
  });
});
