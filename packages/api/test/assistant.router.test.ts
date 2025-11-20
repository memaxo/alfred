import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import {
  createTestCaller,
  createUnauthedCaller,
} from "./utils/trpc";
import {
  getAssistantAgentDefaultsMock,
  resetAgentMocks,
} from "./utils/agent-mock";

setupTestEnv();
mockPolicyAudit();

const generateTextMock = vi.fn();

mock.module("@alfred/api/ai/generate", () => ({
  generateText: generateTextMock,
  persistResult: vi.fn().mockResolvedValue(null),
}));

const handoffExecuteMock = vi.fn();

mock.module("@alfred/agent/assistant/tool/handoff", () => ({
  toolHandoff: {
    execute: handoffExecuteMock,
  },
}));

mock.module("node-pty", () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    kill: vi.fn(),
    resize: vi.fn(),
    write: vi.fn(),
  })),
}));

process.env.DATABASE_URL ??= "postgres://localhost:5432/test";

afterEach(() => {
  resetAllMocks();
  resetAgentMocks();
  vi.restoreAllMocks();
  generateTextMock.mockReset();
  handoffExecuteMock.mockReset();
});

describe("assistant router", () => {
  it("generates assistant completions via generateText", async () => {
    generateTextMock.mockResolvedValue({
      text: "note created",
      toolCalls: [],
      toolResults: [],
      usage: { inputTokens: 10, outputTokens: 15 },
      warnings: [],
      finishReason: "stop",
    });

    const caller = await createTestCaller({
      scopes: ["assistant.write", "assistant.escalate"],
    });
    const result = await caller.assistant.generate({
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "add a note" }],
        },
      ],
      maxSteps: 3,
    });

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const callArgs = generateTextMock.mock.calls[0]?.[0];
    expect(callArgs?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
        }),
      ])
    );
    expect(callArgs?.toolChoice).toBeUndefined();
    expect(callArgs?.model).toBe(
      getAssistantAgentDefaultsMock.mock.results[0]?.value.model
    );
    expect(callArgs?.prepareStep).toBe(
      getAssistantAgentDefaultsMock.mock.results[0]?.value.prepareStep
    );
    expect(result).toMatchObject({
      text: "note created",
      usage: { inputTokens: 10, outputTokens: 15 },
      finishReason: "stop",
    });
  });

  it("throws UNAUTHORIZED when session missing", async () => {
    const caller = await createUnauthedCaller();
    await expect(
      caller.assistant.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "hi" }],
          },
        ],
      })
    ).rejects.toThrow(/Authentication required/);
  });

  it("escalates via handoff tool placeholder", async () => {
    handoffExecuteMock.mockResolvedValue({
      ok: true,
      runId: null,
      next: { kind: "navigate", href: "/orchestrator/run" },
    });

    const caller = await createTestCaller({
      scopes: ["assistant.write", "assistant.escalate"],
    });
    const result = await caller.assistant.escalate({
      requirement: "implement feature",
      authz: "token",
    });

    expect(handoffExecuteMock).toHaveBeenCalledTimes(1);
    const handoffArgs = handoffExecuteMock.mock.calls[0]?.[0];
    expect(handoffArgs?.input).toMatchObject({
      requirement: "implement feature",
      userId: "test-user",
      authz: "token",
      auto: "read",
    });
    expect(handoffArgs?.runtimeContext).toBeDefined();
    expect(result).toEqual({
      ok: true,
      runId: null,
      next: { kind: "navigate", href: "/orchestrator/run" },
    });
  });
});
