import { afterEach, beforeAll, describe, expect, it, vi, mock } from "bun:test";
import { ReadableStream } from "node:stream/web";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { assistantAgentMock, resetAgentMocks } from "./utils/agent-mock";

const handoffExecuteMock = vi.fn();

mock.module("@alfred/agent/assistant/tool/handoff", () => ({
  toolHandoff: {
    execute: handoffExecuteMock,
  },
}));

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

let appRouter: typeof import("@alfred/api/routers/index").appRouter;

beforeAll(() => {
  return import("@alfred/api/routers/index").then(mod => {
    appRouter = mod.appRouter;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  handoffExecuteMock.mockReset();
  resetAgentMocks();
});

function createCaller() {
  const receivedAt = new Date();
  const runtime = {
    requestId: "test-request",
    receivedAt,
    method: "POST",
    url: "http://localhost/test",
    ip: null,
    forwardedFor: [] as string[],
    userAgent: null,
    referer: null,
  };
  const runtimeContext = new RuntimeContext([
    ["requestId", runtime.requestId],
    ["receivedAt", receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["ip", runtime.ip],
    ["forwardedFor", runtime.forwardedFor],
    ["userId", "user-123"],
    ["userRoles", ["owner"]],
    ["userScopes", ["assistant.write", "assistant.escalate"]],
  ]);
  return appRouter.createCaller({
    session: {
      user: {
        id: "user-123",
        roles: ["owner"],
        scopes: ["assistant.write", "assistant.escalate"],
      },
    },
    runtime,
    runtimeContext,
  } as any);
}

describe("assistant router", () => {
  it("generates assistant completions", async () => {
    assistantAgentMock.generate.mockResolvedValue({
      text: "note created",
      toolCalls: [
        {
          payload: {
            toolName: "note",
          },
        },
      ],
      usage: {
        inputTokens: 10,
        outputTokens: 15,
      },
      warnings: [],
    } as any);

    const caller = createCaller();
    const result = await caller.assistant.generate({
      messages: [{ role: "user", content: "add a note" }],
    });

    expect(assistantAgentMock.generate).toHaveBeenCalledTimes(1);
    expect(assistantAgentMock.generate.mock.calls[0]?.[0]).toEqual([{ role: "user", content: "add a note" }]);
    const generateOptions = assistantAgentMock.generate.mock.calls[0]?.[1];
    expect(generateOptions?.runtimeContext).toBeInstanceOf(RuntimeContext);
    expect(generateOptions?.runtimeContext?.get("assistantThread")).toBe("user-123");
    expect(generateOptions?.runtimeContext?.get("assistantMessageCount")).toBe(1);
    expect(result.text).toBe("note created");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.usage).toMatchObject({ inputTokens: 10, outputTokens: 15 });
  });

  it("streams assistant chunks", async () => {
    const streamChunks = [
      { type: "text-delta", payload: { text: "reminder" } },
      { type: "finish", payload: { reason: "stop" } },
    ];

    assistantAgentMock.stream.mockResolvedValue({
      runId: "run-42",
      _getBaseStream: () =>
        new ReadableStream({
          start(controller) {
            for (const chunk of streamChunks) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        }),
    } as any);

    const caller = createCaller();
    const events: Array<Record<string, unknown>> = [];

    const stream = await caller.assistant.stream({
      messages: [{ role: "user", content: "set a reminder" }],
    });

    await new Promise<void>((resolve, reject) => {
      let subscription: { unsubscribe?: () => void } | null = null;
      subscription = (stream as { subscribe: Function }).subscribe({
        next: (event: Record<string, unknown>) => {
          events.push(event);
        },
        error: (error: unknown) => {
          try {
            subscription?.unsubscribe?.();
          } catch {
            // ignore
          }
          reject(error);
        },
        complete: () => {
          try {
            subscription?.unsubscribe?.();
          } catch {
            // ignore
          }
          resolve();
        },
      }) as { unsubscribe?: () => void };
    });

    expect(events[0]).toMatchObject({ type: "run", runId: "run-42" });
    expect(events.slice(1)).toEqual(streamChunks);
    const streamOptions = assistantAgentMock.stream.mock.calls[0]?.[1];
    expect(streamOptions?.runtimeContext).toBeInstanceOf(RuntimeContext);
    expect(streamOptions?.runtimeContext?.get("assistantStream")).toBe(true);
  });

  it("escalates via handoff tool", async () => {
    handoffExecuteMock.mockResolvedValue({ ok: true, runId: "run-7" });

    const caller = createCaller();
    const result = await caller.assistant.escalate({
      requirement: "implement feature",
      authz: "token",
    });

    expect(handoffExecuteMock).toHaveBeenCalledTimes(1);
    const handoffArgs = handoffExecuteMock.mock.calls[0]?.[0];
    expect(handoffArgs?.input).toMatchObject({
      requirement: "implement feature",
      userId: "user-123",
      authz: "token",
    });
    expect(handoffArgs?.runtimeContext).toBeInstanceOf(RuntimeContext);
    expect(handoffArgs?.runtimeContext?.get("assistantEscalateRequirement")).toBe("implement feature");
    expect(result).toEqual({ ok: true, runId: "run-7" });
  });
});
