import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { resetAllMocks, setupTestEnv } from "./utils/router-helpers";

setupTestEnv();

// Capture persisted events
const createdRuns: any[] = [];
const appended: any[] = [];

mock.module("@alfred/db/repo/workflow", () => ({
  createRun: vi.fn().mockImplementation(async (row) => {
    createdRuns.push(row);
    return row;
  }),
  updateRun: vi.fn().mockResolvedValue(undefined),
  appendEvent: vi.fn().mockImplementation(async (evt) => {
    appended.push(evt);
    return evt;
  }),
  getRun: vi.fn().mockResolvedValue(null),
  listEvents: vi.fn().mockImplementation(async (runId: string) =>
    appended
      .filter((e) => e.runId === runId)
      .map((e) => ({
        runId: e.runId,
        eventType: e.eventType,
        eventData: e.eventData,
        stepId: e.stepId ?? null,
        timestamp: new Date(),
      }))
  ),
}));

const generateTextMock = vi.fn();
function normalizeToUiMessagesForTest(result: any): any[] {
  const parts: any[] = [];

  if (typeof result?.text === "string" && result.text.length > 0) {
    parts.push({ type: "text", text: result.text });
  }

  const toolCalls = Array.isArray(result?.toolCalls) ? result.toolCalls : [];
  for (const c of toolCalls) {
    const toolCallId = String(c?.id ?? crypto.randomUUID());
    const toolName = String(c?.name ?? c?.toolName ?? "tool");
    const input = (c?.args ?? c?.input ?? {}) as unknown;
    parts.push({ type: "tool-call", toolCallId, toolName, input });
  }

  const toolResults = Array.isArray(result?.toolResults)
    ? result.toolResults
    : [];
  for (const r of toolResults) {
    const toolCallId = String(r?.id ?? r?.toolCallId ?? crypto.randomUUID());
    const toolName = String(r?.name ?? r?.toolName ?? "tool");
    const output = (r?.result ?? r?.output ?? {}) as unknown;
    parts.push({
      type: "tool-result",
      toolCallId,
      toolName,
      output,
      isError: false,
    });
  }

  return [{ id: crypto.randomUUID(), role: "assistant", parts }];
}

mock.module("@alfred/api/ai/generate", () => ({
  generateText: generateTextMock,
  persistResult: async (args: {
    userId: string;
    kind: "assistant" | "orchestrator";
    input: unknown;
    result: unknown;
  }) => {
    const workflowRepo = await import("@alfred/db/repo/workflow");
    const runId = crypto.randomUUID();
    await workflowRepo.createRun({
      id: runId,
      userId: args.userId,
      workflowId: `${args.kind}-generate`,
      status: "completed",
      inputData: args.input,
      stateData: null,
    });

    const uiMessages = normalizeToUiMessagesForTest(args.result);
    const eventId = crypto.randomUUID();
    await workflowRepo.appendEvent({
      runId,
      eventId,
      eventType: "ui-message",
      eventData: { data: uiMessages },
    });
    return runId;
  },
}));

const { createTestCaller } = await import("./utils/trpc");

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    roles: ["user"],
    scopes: ["assistant.write"],
  });
});

afterEach(() => {
  resetAllMocks();
  createdRuns.length = 0;
  appended.length = 0;
});

describe("assistant.generate persistence & replay", () => {
  it("persists normalized UIMessage parts for non-stream generate", async () => {
    generateTextMock.mockResolvedValue({
      text: "Hello",
      toolCalls: [{ id: "t1", name: "search", args: { q: "alfred" } }],
      toolResults: [{ id: "t1", result: { items: [1, 2] } }],
      usage: { inputTokens: 10, outputTokens: 5 },
      finishReason: "stop",
    });

    const result = await caller.assistant.generate({
      messages: [
        { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
      ],
    } as any);

    expect(result.text).toBe("Hello");
    expect(createdRuns.length).toBe(1);
    expect(appended.length).toBe(1);
    const evt = appended[0];
    expect(evt.eventType).toBe("ui-message");
    const data = (evt.eventData as any)?.data as any[];
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]?.role).toBe("assistant");
    const parts = data[0]?.parts ?? [];
    // Expect text + tool-call + tool-result parts in order
    expect(
      parts.some((p: any) => p.type === "text" && p.text === "Hello")
    ).toBe(true);
    expect(
      parts.some((p: any) => p.type === "tool-call" && p.toolName === "search")
    ).toBe(true);
    expect(
      parts.some(
        (p: any) => p.type === "tool-result" && p.output?.items?.length === 2
      )
    ).toBe(true);
  });
});
