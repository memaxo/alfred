import type { AssistantUIMessage } from "@alfred/agent";

import { describe, expect, it } from "bun:test";

import { deriveActions } from "./use-assistant-stream";

type ToolCallPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input?: unknown;
};

type ToolResultPart = {
  type: "tool-result";
  toolCallId: string;
  toolName?: string;
  output?: unknown;
  isError?: boolean;
};

function createMessage(
  parts: unknown[],
  id = `msg-${Math.random().toString(36).slice(2)}`
): AssistantUIMessage {
  return {
    id,
    role: "assistant",
    parts: parts as unknown as AssistantUIMessage["parts"],
  };
}

describe("deriveActions", () => {
  it("collects tool-call and tool-result pairs", () => {
    const messages: AssistantUIMessage[] = [
      createMessage([
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "planner",
          input: { query: "status" },
        } satisfies ToolCallPart,
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "planner",
          output: { ok: true },
        } satisfies ToolResultPart,
      ]),
    ];

    const actions = deriveActions(messages);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      id: "call-1",
      name: "planner",
      status: "completed",
      result: { ok: true },
      args: { query: "status" },
    });
  });

  it("marks unresolved tool calls as running", () => {
    const messages: AssistantUIMessage[] = [
      createMessage([
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "search",
          input: { query: "hello" },
        } satisfies ToolCallPart,
      ]),
    ];

    const actions = deriveActions(messages);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      id: "call-1",
      name: "search",
      status: "running",
    });
    expect(actions[0]?.result).toBeUndefined();
  });

  it("updates existing action entries with subsequent results", () => {
    const messages: AssistantUIMessage[] = [
      createMessage([
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "search",
          input: { query: "foo" },
        } satisfies ToolCallPart,
      ]),
      createMessage([
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "search",
          output: { matches: 3 },
        } satisfies ToolResultPart,
      ]),
    ];

    const actions = deriveActions(messages);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      id: "call-1",
      status: "completed",
      result: { matches: 3 },
    });
  });
});
