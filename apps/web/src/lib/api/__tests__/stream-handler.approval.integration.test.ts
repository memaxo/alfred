import type { UIMessage } from "@alfred/type/stream";

import {
  convertToModelMessages,
  parseJsonEventStream,
  readUIMessageStream,
  simulateReadableStream,
  tool,
  uiMessageChunkSchema,
} from "ai";
import { afterAll, describe, expect, it, mock, vi } from "bun:test";
import { z } from "zod";

mock.module("@alfred/api/metrics", () => ({
  historyContextSelectionDurationSeconds: {
    startTimer: vi.fn(() => vi.fn()),
  },
  historyContextTierDropsTotal: { inc: vi.fn() },
  historyContextTokensTotal: { inc: vi.fn() },
  preferenceHistoryPrunedTotal: { inc: vi.fn() },
  preferencePromptFailuresTotal: { inc: vi.fn() },
  preferencePromptInjectionsTotal: { inc: vi.fn() },
  sseConnectionRateLimitHitsTotal: {
    labels: vi.fn(() => ({ inc: vi.fn() })),
  },
  sseConnectionsCurrent: {
    labels: vi.fn(() => ({ set: vi.fn() })),
  },
  sseFirstChunkLatencySeconds: {
    labels: vi.fn(() => ({ observe: vi.fn() })),
  },
}));

mock.module("@alfred/api/preference/refresh", () => ({
  triggerPreferenceRefresh: vi.fn(),
}));

mock.module("@alfred/api/utils/sse-connections", () => ({
  createConnection: () => ({ allowed: true, connectionId: "conn-1" }),
  getConnectionCount: () => 0,
  removeConnection: vi.fn(),
  updateConnectionActivity: vi.fn(),
}));

mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({ user: { id: "user-1" } }),
    },
  },
}));

mock.module("@alfred/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

mock.module("@alfred/db/repo/conversation", () => ({
  createConversation: vi.fn().mockResolvedValue({ id: "conv-1" }),
  createMessage: vi.fn().mockResolvedValue(null),
  deleteMessagesAfter: vi.fn().mockResolvedValue(undefined),
}));

mock.module("@alfred/agent/preference/prompt", () => ({
  buildPreferenceSystemPrompt: vi.fn().mockResolvedValue(""),
}));

let callCount = 0;

const model = {
  specificationVersion: "v2",
  provider: "test",
  modelId: "approval-test",
  supportedUrls: {},
  doStream() {
    callCount += 1;

    if (callCount === 1) {
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            {
              type: "tool-call",
              toolCallId: "tool-call-1",
              toolName: "approve_me",
              input: JSON.stringify({ ok: true }),
            },
            {
              type: "finish",
              usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
              finishReason: "tool-calls",
            },
          ],
          initialDelayInMs: 0,
          chunkDelayInMs: 0,
        }),
      };
    }

    return {
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "done" },
          { type: "text-end", id: "text-1" },
          {
            type: "finish",
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
            finishReason: "stop",
          },
        ],
        initialDelayInMs: 0,
        chunkDelayInMs: 0,
      }),
    };
  },
} as const;

mock.module("@alfred/agent/selector", () => ({
  getModelForRole: vi.fn().mockResolvedValue({
    model,
    modelKey: "test/approval-test",
  }),
}));

mock.module("@alfred/agent/mcp", () => ({
  loadMcpTools: vi.fn().mockResolvedValue({
    tools: {},
    close: async () => {},
  }),
}));

let currentTools: Record<string, unknown> = {};

mock.module("@alfred/history", () => ({
  buildHistoryContext: vi.fn(({ messages }) =>
    Promise.resolve({
      uiMessages: messages,
      modelMessages: convertToModelMessages(
        (messages as UIMessage[]).map(({ id: _id, ...rest }) => rest),
        { tools: currentTools as any }
      ),
      droppedMessages: 0,
      keptTokens: 1,
      droppedTokens: 0,
      selection: {
        dropped: [],
        tierByMessage: new WeakMap(),
      },
    })
  ),
  getHistoryBudgetDefaults: () => ({}),
}));

const { handleStreamRequest } = await import("../stream-handler");

async function readLastUIMessage(
  response: Response,
  message?: UIMessage
): Promise<UIMessage> {
  if (!response.body) {
    throw new Error("missing_response_body");
  }

  const parsed = parseJsonEventStream({
    stream: response.body,
    schema: uiMessageChunkSchema,
  });

  const chunks = parsed.pipeThrough(
    new TransformStream({
      transform(part, controller) {
        if (!part.success) {
          throw part.error;
        }
        controller.enqueue(part.value);
      },
    })
  );

  const messages = readUIMessageStream({ stream: chunks, message });
  let last: UIMessage | null = null;
  for await (const message of messages) {
    last = message as unknown as UIMessage;
  }
  if (!last) {
    throw new Error("no_ui_messages_emitted");
  }
  return last;
}

describe("handleStreamRequest approval round trip", () => {
  it("does not execute tools until approved, then executes after approval", async () => {
    callCount = 0;
    const executeSpy = vi.fn(async () => ({ ok: "executed" }));

    const tools = {
      approve_me: tool({
        description: "Test tool that requires approval.",
        inputSchema: z.object({ ok: z.boolean() }),
        needsApproval: true,
        execute: executeSpy,
      }),
    };

    currentTools = tools as any;

    const userMessage: UIMessage = {
      id: "user-1",
      role: "user",
      parts: [{ type: "text", text: "call the tool" }],
    };

    const request1 = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [userMessage] }),
    });

    const response1 = await handleStreamRequest(
      request1,
      () => ({ model: model as any, tools }) as any,
      "assistant"
    );

    expect(response1.status).toBe(200);
    const assistant1 = await readLastUIMessage(response1);

    const toolPart1 = (assistant1.parts ?? []).find(
      (p) =>
        typeof (p as any)?.type === "string" &&
        (p as any).type === "tool-approve_me"
    ) as any;

    expect(toolPart1).toBeTruthy();
    expect(toolPart1.state).toBe("approval-requested");
    expect(toolPart1.approval?.id).toBeTruthy();
    expect(executeSpy).toHaveBeenCalledTimes(0);

    const approvalId = toolPart1.approval.id as string;

    const approvedAssistant: UIMessage = {
      ...assistant1,
      parts: (assistant1.parts ?? []).map((p: any) => {
        if (p?.type === "tool-approve_me" && p?.approval?.id === approvalId) {
          return {
            ...p,
            state: "approval-responded",
            approval: { id: approvalId, approved: true },
          };
        }
        return p;
      }),
    };

    const request2 = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [userMessage, approvedAssistant] }),
    });

    const response2 = await handleStreamRequest(
      request2,
      () => ({ model: model as any, tools }) as any,
      "assistant"
    );

    expect(response2.status).toBe(200);
    const assistant2 = await readLastUIMessage(response2, approvedAssistant);

    const toolPart2 = (assistant2.parts ?? []).find(
      (p) =>
        typeof (p as any)?.type === "string" &&
        (p as any).type === "tool-approve_me"
    ) as any;

    expect(toolPart2).toBeTruthy();
    expect(toolPart2.state).toBe("output-available");
    expect(toolPart2.output).toEqual({ ok: "executed" });
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it("does not execute tools when denied, and surfaces a terminal tool state", async () => {
    callCount = 0;
    const executeSpy = vi.fn(async () => ({ ok: "executed" }));

    const tools = {
      approve_me: tool({
        description: "Test tool that requires approval.",
        inputSchema: z.object({ ok: z.boolean() }),
        needsApproval: true,
        execute: executeSpy,
      }),
    };

    currentTools = tools as any;

    const userMessage: UIMessage = {
      id: "user-1",
      role: "user",
      parts: [{ type: "text", text: "call the tool" }],
    };

    const request1 = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [userMessage] }),
    });

    const response1 = await handleStreamRequest(
      request1,
      () => ({ model: model as any, tools }) as any,
      "assistant"
    );

    expect(response1.status).toBe(200);
    const assistant1 = await readLastUIMessage(response1);

    const toolPart1 = (assistant1.parts ?? []).find(
      (p) =>
        typeof (p as any)?.type === "string" &&
        (p as any).type === "tool-approve_me"
    ) as any;

    expect(toolPart1).toBeTruthy();
    expect(toolPart1.state).toBe("approval-requested");
    expect(toolPart1.approval?.id).toBeTruthy();
    expect(executeSpy).toHaveBeenCalledTimes(0);

    const approvalId = toolPart1.approval.id as string;

    const deniedAssistant: UIMessage = {
      ...assistant1,
      parts: (assistant1.parts ?? []).map((p: any) => {
        if (p?.type === "tool-approve_me" && p?.approval?.id === approvalId) {
          return {
            ...p,
            state: "approval-responded",
            approval: { id: approvalId, approved: false },
          };
        }
        return p;
      }),
    };

    const request2 = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [userMessage, deniedAssistant] }),
    });

    const response2 = await handleStreamRequest(
      request2,
      () => ({ model: model as any, tools }) as any,
      "assistant"
    );

    expect(response2.status).toBe(200);
    const assistant2 = await readLastUIMessage(response2, deniedAssistant);

    const toolPart2 = (assistant2.parts ?? []).find(
      (p) =>
        typeof (p as any)?.type === "string" &&
        (p as any).type === "tool-approve_me"
    ) as any;

    expect(toolPart2).toBeTruthy();
    expect(toolPart2.state).not.toBe("approval-requested");
    expect(toolPart2.state).not.toBe("running");
    expect(toolPart2.state).not.toBe("output-available");
    expect(executeSpy).toHaveBeenCalledTimes(0);
  });
});

afterAll(() => {
  mock.restore();
});
