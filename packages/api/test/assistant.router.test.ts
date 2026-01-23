import { afterEach, describe, expect, it, vi } from "bun:test";
import {
  getAssistantAgentDefaultsMock,
  resetAgentMocks,
} from "./utils/agent-mock";
import { aiStub, metricsStub } from "./utils/mock-metrics";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";
import { createMockDeps } from "@alfred/api/deps";

setupTestEnv();
mockPolicyAudit();

const generateTextMock = vi.fn();
const persistResultMock = vi.fn();
const handoffExecuteMock = vi.fn();
const validateUIMessagesMock = aiStub.validateUIMessages;

afterEach(() => {
  resetAllMocks();
  resetAgentMocks();
  generateTextMock.mockReset();
  persistResultMock.mockReset();
  handoffExecuteMock.mockReset();
  validateUIMessagesMock.mockClear();
  metricsStub.assistantGenerateRequestsTotal.inc.mockClear();
  metricsStub.assistantGenerateDurationSeconds.startTimer.mockClear();
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
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
          persistResult: persistResultMock,
        },
      }),
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
    expect(Array.isArray(callArgs?.messages)).toBe(true);
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
    expect(metricsStub.assistantGenerateRequestsTotal.inc).toHaveBeenCalledWith(
      { status: "started" }
    );
    expect(metricsStub.assistantGenerateRequestsTotal.inc).toHaveBeenCalledWith(
      { status: "success" }
    );
    expect(
      metricsStub.assistantGenerateDurationSeconds.startTimer
    ).toHaveBeenCalledTimes(1);
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
      summary: null,
      ticketId: null,
      ticketUrl: null,
      plan: null,
      results: null,
      next: { kind: "navigate", href: "/orchestrator/run" },
    });

    const caller = await createTestCaller({
      scopes: ["assistant.write", "assistant.escalate"],
      deps: createMockDeps({
        assistant: {
          handoffExecute: handoffExecuteMock,
        },
      }),
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
      summary: null,
      ticketId: null,
      ticketUrl: null,
      plan: null,
      results: null,
      next: { kind: "navigate", href: "/orchestrator/run" },
    });
  });

  it("bubbles validation errors", async () => {
    validateUIMessagesMock.mockRejectedValueOnce(new Error("invalid"));

    const caller = await createTestCaller({
      scopes: ["assistant.write", "assistant.escalate"],
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
          persistResult: persistResultMock,
        },
      }),
    });

    await expect(
      caller.assistant.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "invalid" }],
          },
        ],
      })
    ).rejects.toThrow(/invalid_message/);
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(metricsStub.assistantGenerateRequestsTotal.inc).toHaveBeenCalledWith(
      {
        status: "started",
      }
    );
    expect(metricsStub.assistantGenerateRequestsTotal.inc).toHaveBeenCalledWith(
      {
        status: "error",
      }
    );
  });

  it("rejects empty messages array", async () => {
    const caller = await createTestCaller({
      scopes: ["assistant.write"],
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
        },
      }),
    });

    await expect(
      caller.assistant.generate({
        messages: [],
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("rejects invalid projectId UUID", async () => {
    const caller = await createTestCaller({
      scopes: ["assistant.write"],
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
        },
      }),
    });

    await expect(
      caller.assistant.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "test" }],
          },
        ],
        projectId: "not-a-uuid",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects maxSteps below minimum", async () => {
    const caller = await createTestCaller({
      scopes: ["assistant.write"],
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
        },
      }),
    });

    await expect(
      caller.assistant.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "test" }],
          },
        ],
        maxSteps: 0,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects maxSteps above maximum", async () => {
    const caller = await createTestCaller({
      scopes: ["assistant.write"],
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
        },
      }),
    });

    await expect(
      caller.assistant.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "test" }],
          },
        ],
        maxSteps: 13,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects invalid memory.topK below minimum", async () => {
    const caller = await createTestCaller({
      scopes: ["assistant.write"],
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
        },
      }),
    });

    await expect(
      caller.assistant.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "test" }],
          },
        ],
        memory: {
          semanticRecall: {
            topK: 0,
          },
        },
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects invalid memory.topK above maximum", async () => {
    const caller = await createTestCaller({
      scopes: ["assistant.write"],
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
        },
      }),
    });

    await expect(
      caller.assistant.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "test" }],
          },
        ],
        memory: {
          semanticRecall: {
            topK: 11,
          },
        },
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects invalid memory.messageRange below minimum", async () => {
    const caller = await createTestCaller({
      scopes: ["assistant.write"],
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
        },
      }),
    });

    await expect(
      caller.assistant.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "test" }],
          },
        ],
        memory: {
          semanticRecall: {
            messageRange: -1,
          },
        },
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects invalid memory.messageRange above maximum", async () => {
    const caller = await createTestCaller({
      scopes: ["assistant.write"],
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
        },
      }),
    });

    await expect(
      caller.assistant.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "test" }],
          },
        ],
        memory: {
          semanticRecall: {
            messageRange: 11,
          },
        },
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects empty requirement for escalate", async () => {
    const caller = await createTestCaller({
      scopes: ["assistant.write", "assistant.escalate"],
      deps: createMockDeps({
        assistant: {
          handoffExecute: handoffExecuteMock,
        },
      }),
    });

    await expect(
      caller.assistant.escalate({
        requirement: "",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(handoffExecuteMock).not.toHaveBeenCalled();
  });

  it("handles generateText errors gracefully", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("API error"));

    const caller = await createTestCaller({
      scopes: ["assistant.write"],
      deps: createMockDeps({
        assistant: {
          generateText: generateTextMock,
          persistResult: persistResultMock,
        },
      }),
    });

    await expect(
      caller.assistant.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "test" }],
          },
        ],
      })
    ).rejects.toThrow();
    expect(metricsStub.assistantGenerateRequestsTotal.inc).toHaveBeenCalledWith(
      { status: "started" }
    );
    expect(metricsStub.assistantGenerateRequestsTotal.inc).toHaveBeenCalledWith(
      { status: "error" }
    );
  });
});
