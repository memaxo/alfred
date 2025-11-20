import "@/test/dom";
import { beforeEach, describe, expect, it } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import { act, renderHook, waitFor } from "@testing-library/react";
import { assistantChatMock } from "@/test/mock-assistant-chat";
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
  beforeEach(() => {
    assistantChatMock.reset();
  });

  it("sends user input through the chat transport", async () => {
    const { result } = renderHook(() => useAssistantStream());

    await act(async () => {
      result.current.send("Ping transport");
    });

    await waitFor(() => {
      expect(assistantChatMock.sendSpy).toHaveBeenCalledWith("Ping transport");
      expect(result.current.messages.at(-1)?.parts[0]).toMatchObject({
        type: "text",
        text: "Ping transport",
      });
    });
  });

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
          input: { query: "alfred" },
        },
        {
          type: "tool-result",
          toolCallId: "call-123",
          toolName: "search",
          output: { url: "https://example.com" },
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
