import "@/test/dom";
import type { ReactNode } from "react";
import type { UIMessage } from "@alfred/type/stream";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "bun:test";
import { ChatContainer } from "../chat-container";

vi.mock("react-virtuoso", () => ({
  Virtuoso: ({ data, itemContent }: { data: UIMessage[]; itemContent: (index: number, message: UIMessage) => ReactNode }) => (
    <div data-testid="stub-virtuoso">
      {data.map((message, index) => (
        <div key={message.id ?? `message-${index}`}>{itemContent(index, message)}</div>
      ))}
    </div>
  ),
}));

const sendSpy = vi.fn();
const clearSpy = vi.fn();
const hydrateSpy = vi.fn();

vi.mock("@/hooks/use-assistant-stream", () => {
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
    render(<ChatContainer agent="assistant" />);

    const input = screen.getByPlaceholderText(/Ask Alfred/i);
    fireEvent.change(input, { target: { value: "Hello world" } });
    fireEvent.submit(input.closest("form") ?? input);

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith("Hello world");
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });
  });

  it("clears messages when the clear button is pressed", async () => {
    render(<ChatContainer agent="assistant" />);

    const input = screen.getByPlaceholderText(/Ask Alfred/i);
    fireEvent.change(input, { target: { value: "To clear" } });
    fireEvent.submit(input.closest("form") ?? input);

    await waitFor(() => {
      expect(screen.getByText("To clear")).toBeInTheDocument();
    });

    const clearButton = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(clearSpy).toHaveBeenCalled();
      expect(screen.queryByText("To clear")).not.toBeInTheDocument();
    });
  });

  it("hydrates messages when switching agents", async () => {
    render(<ChatContainer agent="assistant" />);

    const input = screen.getByPlaceholderText(/Ask Alfred/i);
    fireEvent.change(input, { target: { value: "Agent state" } });
    fireEvent.submit(input.closest("form") ?? input);

    await waitFor(() => {
      expect(screen.getByText("Agent state")).toBeInTheDocument();
    });

    const orchestratorSwitch = screen.getByRole("button", { name: /orchestrator/i });
    fireEvent.click(orchestratorSwitch);

    await waitFor(() => {
      expect(hydrateSpy).toHaveBeenCalled();
      expect(screen.queryByText("Agent state")).not.toBeInTheDocument();
    });

    const assistantSwitch = screen.getByRole("button", { name: /assistant/i });
    fireEvent.click(assistantSwitch);

    await waitFor(() => {
      expect(screen.getByText("Agent state")).toBeInTheDocument();
    });
  });
});
