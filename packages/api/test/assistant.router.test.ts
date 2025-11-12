import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { RuntimeContext } from "@alfred/type/runtime-context";

const generateTextMock = vi.fn();

mock.module("@alfred/api/ai/generate", () => ({
  generateText: generateTextMock,
  persistGenerateResult: vi.fn().mockResolvedValue(null),
}));

const handoffExecuteMock = vi.fn();

mock.module("@alfred/agent/assistant/tool/handoff", () => ({
  toolHandoff: {
    execute: handoffExecuteMock,
  },
}));

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

process.env.DATABASE_URL ??= "postgres://localhost:5432/test";

let assistantRouter: typeof import("@alfred/api/routers/assistant").assistantRouter;

beforeAll(async () => {
  const mod = await import("@alfred/api/routers/assistant");
  assistantRouter = mod.assistantRouter;
});

afterEach(() => {
  vi.restoreAllMocks();
  generateTextMock.mockReset();
  handoffExecuteMock.mockReset();
  mock.restore();
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

  return assistantRouter.createCaller({
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

describe.skip("assistant router", () => {
  it("generates assistant completions via generateText", async () => {
    generateTextMock.mockResolvedValue({
      text: "note created",
      toolCalls: [],
      toolResults: [],
      usage: { inputTokens: 10, outputTokens: 15 },
      warnings: [],
      finishReason: "stop",
    });

    const caller = createCaller();
    const result = await caller.generate({
      messages: [{ role: "user", content: "add a note" }],
      maxSteps: 3,
    });

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const callArgs = generateTextMock.mock.calls[0]?.[0];
    expect(callArgs?.messages).toEqual([
      { role: "user", content: "add a note" },
    ]);
    expect(callArgs?.toolChoice).toBeUndefined();
    expect(callArgs?.stopWhen).toBeDefined();
    expect(typeof callArgs?.stopWhen).toBe("function");
    expect(result).toMatchObject({
      text: "note created",
      usage: { inputTokens: 10, outputTokens: 15 },
      finishReason: "stop",
    });
  });

  it("escalates via handoff tool placeholder", async () => {
    handoffExecuteMock.mockResolvedValue({
      ok: true,
      runId: null,
      next: { kind: "navigate", href: "/orchestrator/run" },
    });

    const caller = createCaller();
    const result = await caller.escalate({
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
    expect(result).toEqual({
      ok: true,
      runId: null,
      next: { kind: "navigate", href: "/orchestrator/run" },
    });
  });
});
