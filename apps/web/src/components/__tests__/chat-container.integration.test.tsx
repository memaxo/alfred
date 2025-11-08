import "@/test/dom";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import { fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ChatContainer } from "../chat-container";

mock.module("react-virtuoso", () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: UIMessage[];
    itemContent: (index: number, message: UIMessage) => ReactNode;
  }) => (
    <div data-testid="stub-virtuoso">
      {data.map((message, index) => (
        <div key={message.id ?? `message-${index}`}>
          {itemContent(index, message)}
        </div>
      ))}
    </div>
  ),
}));

const sendSpy = vi.fn();
const clearSpy = vi.fn();
const hydrateSpy = vi.fn();

mock.module("@/hooks/use-assistant-stream", () => {
  const { useCallback, useState } = require("react");

  const createMessage = (text: string): UIMessage => ({
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: "user",
    parts: [{ type: "text", text }],
    metadata: { status: "sent" },
  });

  return {
    useAssistantStream: () => {
      const [messages, setMessages] = useState<UIMessage[]>([]);
      const send = useCallback((text: string) => {
        sendSpy(text);
        setMessages((prev) => [...prev, createMessage(text)]);
      }, []);
      const clear = useCallback(() => {
        clearSpy();
        setMessages([]);
      }, []);
      const hydrate = useCallback((snapshot: UIMessage[]) => {
        hydrateSpy(snapshot);
        setMessages(snapshot);
      }, []);

      return {
        messages,
        actions: [],
        status: "ready",
        error: null,
        send,
        clear,
        hydrate,
      };
    },
  };
});

describe("ChatContainer integration", () => {
  beforeEach(() => {
    sendSpy.mockClear();
    clearSpy.mockClear();
    hydrateSpy.mockClear();
  });

  it("sends messages through the assistant stream hook", async () => {
    const { getByPlaceholderText, getByText } = render(
      <ChatContainer agent="assistant" />
    );

    const input = getByPlaceholderText(/Ask Alfred/i);
    fireEvent.change(input, { target: { value: "Hello world" } });
    fireEvent.submit(input.closest("form") ?? input);

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith("Hello world");
      expect(getByText("Hello world")).toBeTruthy();
    });
  });

  it("clears messages when the clear button is pressed", async () => {
    const { getByPlaceholderText, getByText, getByRole, queryByText } = render(
      <ChatContainer agent="assistant" />
    );

    const input = getByPlaceholderText(/Ask Alfred/i);
    fireEvent.change(input, { target: { value: "To clear" } });
    fireEvent.submit(input.closest("form") ?? input);

    await waitFor(() => {
      expect(getByText("To clear")).toBeTruthy();
    });

    const clearButton = getByRole("button", { name: /clear/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(clearSpy).toHaveBeenCalled();
      expect(queryByText("To clear")).toBeNull();
    });
  });

  it("hydrates messages when switching agents", async () => {
    const { getByPlaceholderText, getByText, getByRole, queryByText } = render(
      <ChatContainer agent="assistant" />
    );

    const input = getByPlaceholderText(/Ask Alfred/i);
    fireEvent.change(input, { target: { value: "Agent state" } });
    fireEvent.submit(input.closest("form") ?? input);

    await waitFor(() => {
      expect(getByText("Agent state")).toBeTruthy();
    });

    const orchestratorSwitch = getByRole("button", { name: /orchestrator/i });
    fireEvent.click(orchestratorSwitch);

    await waitFor(() => {
      expect(hydrateSpy).toHaveBeenCalled();
      expect(queryByText("Agent state")).toBeNull();
    });

    const assistantSwitch = getByRole("button", { name: /assistant/i });
    fireEvent.click(assistantSwitch);

    await waitFor(() => {
      expect(getByText("Agent state")).toBeTruthy();
    });
  });
});
