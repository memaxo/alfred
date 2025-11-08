import "@/test/dom";
import { describe, expect, it } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import type { UIMessage } from "@alfred/type/stream";
import { useAssistantStream } from "../use-assistant-stream";

const baseMessage: UIMessage = {
  id: "msg-1",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Hello",
    },
  ],
};

describe("useAssistantStream integration (without network)", () => {
  it("hydrates pre-existing messages", () => {
    const { result } = renderHook(() => useAssistantStream());

    act(() => {
      result.current.hydrate([baseMessage]);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.id).toBe("msg-1");
    expect(result.current.actions).toHaveLength(0);
  });

  it("derives actions from tool call parts", () => {
    const toolMessage: UIMessage = {
      id: "msg-tool",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "call-123",
          toolName: "search",
          args: { query: "alfred" },
        },
        {
          type: "tool-result",
          toolCallId: "call-123",
          toolName: "search",
          result: { url: "https://example.com" },
        },
      ],
    };

    const { result } = renderHook(() => useAssistantStream());

    act(() => {
      result.current.hydrate([toolMessage]);
    });

    expect(result.current.actions).toHaveLength(1);
    expect(result.current.actions[0]).toMatchObject({
      id: "call-123",
      name: "search",
      status: "completed",
    });
  });

  it("clears messages and resets error state", () => {
    const { result } = renderHook(() => useAssistantStream());

    act(() => {
      result.current.hydrate([baseMessage]);
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
