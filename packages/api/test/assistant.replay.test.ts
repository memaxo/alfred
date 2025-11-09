import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { createTestCaller, resetAllMocks, setupTestEnv } from "./utils/router-helpers";

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
  listEvents: vi.fn().mockImplementation(async (runId: string) => {
    return appended.filter((e) => e.runId === runId).map((e) => ({
      runId: e.runId,
      eventType: e.eventType,
      eventData: e.eventData,
      stepId: e.stepId ?? null,
      timestamp: new Date(),
    }));
  }),
}));

// Mock generateText but keep real persistResult from the module
const generateTextMock = vi.fn();
mock.module("@alfred/api/ai/generate", async () => {
  const real = await import("../../src/ai/generate");
  return {
    generateText: generateTextMock,
    persistResult: real.persistResult,
  };
});

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({ roles: ["user"], scopes: ["assistant.write"] });
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
      toolCalls: [
        { id: "t1", name: "search", args: { q: "alfred" } },
      ],
      toolResults: [
        { id: "t1", result: { items: [1, 2] } },
      ],
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
    const data = evt.eventData as any[];
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]?.role).toBe("assistant");
    const parts = data[0]?.parts ?? [];
    // Expect text + tool-call + tool-result parts in order
    expect(parts.some((p: any) => p.type === "text" && p.text === "Hello")).toBe(true);
    expect(parts.some((p: any) => p.type === "tool-call" && p.toolName === "search")).toBe(true);
    expect(parts.some((p: any) => p.type === "tool-result" && p.output?.items?.length === 2)).toBe(true);
  });
});
