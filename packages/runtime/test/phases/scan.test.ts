import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  ContextBundle,
  SearchReceipt,
  WorkflowEvent,
} from "@alfred/type/plan";
import type { ExecutionContext } from "../../src/context";
import type { RuntimeInput } from "../../src/types";

const gatherCodeContextMock = mock(
  async (params: {
    writer?: { write?: (chunk: unknown) => Promise<void> | void };
  }) => {
    await params.writer?.write?.({
      _: "context",
      phase: "scan",
      message: "code_context_mock",
    });
    return {
      code: [
        {
          id: "code:src/index.ts",
          kind: "code",
          path: "src/index.ts",
          score: 0.92,
          reason: "Matches requirement",
        },
      ],
      created: new Date(),
      summary: "code summary",
    } satisfies SearchReceipt;
  }
);

const gatherWebContextMock = mock(
  async (params: {
    writer?: { write?: (chunk: unknown) => Promise<void> | void };
  }) => {
    await params.writer?.write?.({
      _: "context",
      phase: "web",
      message: "web_context_mock",
    });
    return {
      code: [],
      web: [
        {
          id: "web:https://example.com",
          kind: "web",
          url: "https://example.com",
          title: "Example",
          score: 0.75,
          snippet: "Example snippet",
        },
      ],
      created: new Date(),
      summary: "web summary",
    } satisfies SearchReceipt;
  }
);

mock.module("@alfred/agent/orchestrator/flow/context", () => ({
  gatherCodeContext: gatherCodeContextMock,
  gatherWebContext: gatherWebContextMock,
  buildContextBundle: async () => ({
    maxTokens: 24_000,
    estimatedTokens: 0,
    files: [],
    links: [],
  }),
}));

const { executeScanPhase } = await import("../../src/phases/scan");

const baseInput: RuntimeInput = {
  requirement: "Implement scan phase",
  auto: "low",
  workspace: "/tmp/runtime",
  repoBase: "/tmp/runtime",
  context: {
    web: true,
    topK: 5,
    maxTokens: 24_000,
    exts: [".ts"],
    ignore: ["dist"],
    seeds: ["packages/runtime/src"],
  },
};

function cloneInput(overrides: Partial<RuntimeInput> = {}): RuntimeInput {
  const mergedContext =
    overrides.context === undefined
      ? baseInput.context
      : {
          ...(baseInput.context ?? {}),
          ...overrides.context,
        };
  return {
    ...baseInput,
    ...overrides,
    context: mergedContext,
  } as RuntimeInput;
}

function createExecutionContext(
  overrides: Partial<ExecutionContext> = {}
): ExecutionContext {
  const receipts: SearchReceipt = {
    code: [
      {
        id: "code:src/index.ts",
        kind: "code",
        path: "src/index.ts",
        score: 0.92,
        reason: "Matches requirement",
      },
    ],
    web: [
      {
        id: "web:https://example.com",
        kind: "web",
        url: "https://example.com",
        title: "Example",
        score: 0.75,
        snippet: "Example snippet",
      },
    ],
    created: new Date(),
    summary: "Example receipt",
  };

  const bundle: ContextBundle = {
    maxTokens: 24_000,
    estimatedTokens: 512,
    files: [
      {
        path: "src/index.ts",
        startLine: 1,
        endLine: 20,
        tokens: 120,
        content: "const value = 42;",
      },
    ],
    links: [],
    note: "Context bundle",
  };

  return {
    requirement: baseInput.requirement,
    receipts,
    bundle,
    totalTokens: 1024,
    ragChunks: [],
    ragDocumentIds: ["doc-1"],
    ...overrides,
  } as ExecutionContext;
}

async function collectEvents(
  generator: AsyncGenerator<WorkflowEvent, ExecutionContext | null, void>
) {
  const events: WorkflowEvent[] = [];
  let result: ExecutionContext | null | undefined;
  try {
    const iter = generator[Symbol.asyncIterator]();
    while (true) {
      const next = await iter.next();
      if (next.done) {
        result = next.value ?? null;
        break;
      }
      events.push(next.value);
    }
    return { events, result };
  } catch (error) {
    return { events, error, result };
  }
}

describe("executeScanPhase", () => {
  beforeEach(() => {
    gatherCodeContextMock.mockReset();
    gatherCodeContextMock.mockImplementation(async (params: any) => {
      await params?.writer?.write?.({
        _: "context",
        phase: "scan",
        message: "code_context_mock",
      });
      return {
        code: createExecutionContext().receipts.code,
        created: new Date(),
        summary: "code summary",
      } satisfies SearchReceipt;
    });
    gatherWebContextMock.mockReset();
    gatherWebContextMock.mockImplementation(async (params: any) => {
      await params?.writer?.write?.({
        _: "context",
        phase: "web",
        message: "web_context_mock",
      });
      return {
        code: [],
        web: createExecutionContext().receipts.web,
        created: new Date(),
        summary: "web summary",
      } satisfies SearchReceipt;
    });
  });

  it("gathers context and emits receipts, web, and bundle events", async () => {
    const input = cloneInput();
    const controller = new AbortController();

    const generator = executeScanPhase(input, "run-ctx", controller.signal);
    const { events, error, result } = await collectEvents(generator);

    expect(error).toBeUndefined();
    expect(gatherCodeContextMock).toHaveBeenCalledTimes(1);
    expect(gatherWebContextMock).toHaveBeenCalledTimes(1);

    const writerEvents = events.filter(
      (event) =>
        event._ === "context" && (event as any).message === "code_context_mock"
    );
    expect(writerEvents.length).toBeGreaterThan(0);

    const scanEvents = events.filter(
      (event) => event._ === "context" && (event as any).phase === "scan"
    );
    expect(scanEvents.length).toBeGreaterThanOrEqual(2);
    expect(scanEvents.some((event) => Boolean((event as any).receipts))).toBe(
      true
    );

    const webEvent = events.find(
      (event) => event._ === "context" && (event as any).phase === "web"
    );
    expect(webEvent).toBeDefined();

    const bundleEvent = events.find(
      (event) => event._ === "context" && (event as any).phase === "bundle"
    );
    expect(bundleEvent).toBeDefined();

    expect(events.at(-1)).toMatchObject({
      _: "notice",
      message: "context_gathering_completed",
    });

    expect(result).not.toBeNull();
  });

  it("throws when aborted before building context", async () => {
    const controller = new AbortController();
    controller.abort();

    const generator = executeScanPhase(
      cloneInput(),
      "run-abort",
      controller.signal
    );
    const { events, error, result } = await collectEvents(generator);

    expect(gatherCodeContextMock).not.toHaveBeenCalled();
    expect(gatherWebContextMock).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({
      _: "context",
      phase: "scan",
      message: "gathering_context",
    });
    expect(error).toBeInstanceOf(Error);
    expect(result).toBeUndefined();
  });

  it("emits failure notice when context building throws", async () => {
    gatherCodeContextMock.mockImplementationOnce(async () => {
      throw new Error("context exploded");
    });

    const generator = executeScanPhase(
      cloneInput(),
      "run-error",
      new AbortController().signal
    );
    const { events, error, result } = await collectEvents(generator);

    const failureEvent = events.find(
      (event) =>
        event._ === "notice" &&
        (event as any).message === "context_gathering_failed"
    );

    expect(failureEvent).toBeDefined();
    expect((failureEvent as any).error).toBe("context exploded");
    expect(error).toBeInstanceOf(Error);
    expect(result).toBeUndefined();
    expect(gatherCodeContextMock).toHaveBeenCalledTimes(1);
  });

  it("skips gathering when context is disabled", async () => {
    const input = cloneInput({
      context: {
        ...(baseInput.context ?? {}),
        enable: false,
      },
    });

    const generator = executeScanPhase(
      input,
      "run-disabled",
      new AbortController().signal
    );
    const { events, error, result } = await collectEvents(generator);

    expect(error).toBeUndefined();
    expect(gatherCodeContextMock).not.toHaveBeenCalled();
    expect(gatherWebContextMock).not.toHaveBeenCalled();
    const disabledNotice = events.find(
      (event) =>
        event._ === "notice" &&
        (event as any).message === "context_gathering_disabled"
    );
    expect(disabledNotice).toBeDefined();
    expect(result).toBeNull();
  });

  afterAll(() => {
    mock.restore();
  });
});
