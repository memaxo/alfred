import { describe, expect, it } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import { deriveActions } from "./use-assistant-stream";

function createMessage(
  parts: UIMessage["parts"],
  id = `msg-${Math.random().toString(36).slice(2)}`
): UIMessage {
  return {
    id,
    role: "assistant",
    parts,
  };
}

describe("deriveActions", () => {
  it("collects tool-call and tool-result pairs", () => {
    const messages: UIMessage[] = [
      createMessage([
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "planner",
          input: { query: "status" },
        },
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "planner",
          output: { ok: true },
        },
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
    const messages: UIMessage[] = [
      createMessage([
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "search",
          input: { q: "alfred" },
        },
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
    const messages: UIMessage[] = [
      createMessage([
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "search",
          input: { q: "alfred" },
        },
      ]),
      createMessage([
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "search",
          output: { matches: 3 },
        },
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
