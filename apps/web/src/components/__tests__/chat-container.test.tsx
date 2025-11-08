import "@/test/dom";
import { describe, expect, it, vi } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useCallback as reactUseCallback,
  useState as reactUseState,
} from "react";
import { ChatContainer } from "../chat-container";

vi.mock("react-virtuoso", () => ({
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

vi.mock("@/hooks/use-assistant-stream", () => {
  const createMessage = (text: string): UIMessage => ({
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: "user",
    parts: [{ type: "text", text }],
    metadata: { status: "sent" },
  });

  return {
    useAssistantStream: () => {
      const [messages, setMessages] = reactUseState<UIMessage[]>([]);
      const send = reactUseCallback((text: string) => {
        setMessages((prev) => [...prev, createMessage(text)]);
      }, []);
      const clear = reactUseCallback(() => {
        setMessages([]);
      }, []);
      const hydrate = reactUseCallback((snapshot: UIMessage[]) => {
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

describe("ChatContainer", () => {
  describe("agent switching", () => {
    it("saves current state to contextsRef on switch", async () => {
      const { container } = render(<ChatContainer agent="assistant" />);

      const input = screen.getByPlaceholderText(/Ask Alfred/i);
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.submit(input.closest("form") ?? input);

      await waitFor(() => {
        expect(screen.getByText("Test message")).toBeInTheDocument();
      });

      const agentSwitch = screen.getByRole("button", { name: /orchestrator/i });
      fireEvent.click(agentSwitch);

      await waitFor(() => {
        expect(screen.queryByText("Test message")).not.toBeInTheDocument();
      });
    });

    it("hydrates previous state correctly on switch", async () => {
      const { container } = render(<ChatContainer agent="assistant" />);

      const input = screen.getByPlaceholderText(/Ask Alfred/i);
      fireEvent.change(input, { target: { value: "First message" } });
      fireEvent.submit(input.closest("form") ?? input);

      await waitFor(() => {
        expect(screen.getByText("First message")).toBeInTheDocument();
      });

      const agentSwitch = screen.getByRole("button", { name: /orchestrator/i });
      fireEvent.click(agentSwitch);

      await waitFor(() => {
        expect(screen.queryByText("First message")).not.toBeInTheDocument();
      });

      const assistantSwitch = screen.getByRole("button", {
        name: /assistant/i,
      });
      fireEvent.click(assistantSwitch);

      await waitFor(() => {
        expect(screen.getByText("First message")).toBeInTheDocument();
      });
    });

    it("clears current state before switching", async () => {
      const { container } = render(<ChatContainer agent="assistant" />);

      const input = screen.getByPlaceholderText(/Ask Alfred/i);
      fireEvent.change(input, { target: { value: "Test" } });
      fireEvent.submit(input.closest("form") ?? input);

      await waitFor(() => {
        expect(screen.getByText("Test")).toBeInTheDocument();
      });

      const agentSwitch = screen.getByRole("button", { name: /orchestrator/i });
      fireEvent.click(agentSwitch);

      await waitFor(() => {
        expect(screen.queryByText("Test")).not.toBeInTheDocument();
      });
    });

    it("preserves independent state for multiple agents", async () => {
      const { container } = render(<ChatContainer agent="assistant" />);

      const input = screen.getByPlaceholderText(/Ask Alfred/i);
      fireEvent.change(input, { target: { value: "Assistant message" } });
      fireEvent.submit(input.closest("form") ?? input);

      await waitFor(() => {
        expect(screen.getByText("Assistant message")).toBeInTheDocument();
      });

      const orchestratorSwitch = screen.getByRole("button", {
        name: /orchestrator/i,
      });
      fireEvent.click(orchestratorSwitch);

      await waitFor(() => {
        expect(screen.queryByText("Assistant message")).not.toBeInTheDocument();
      });

      const assistantSwitch = screen.getByRole("button", {
        name: /assistant/i,
      });
      fireEvent.click(assistantSwitch);

      await waitFor(() => {
        expect(screen.getByText("Assistant message")).toBeInTheDocument();
      });
    });

    it("clear button resets current agent state", async () => {
      const { container } = render(<ChatContainer agent="assistant" />);

      const input = screen.getByPlaceholderText(/Ask Alfred/i);
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.submit(input.closest("form") ?? input);

      await waitFor(() => {
        expect(screen.getByText("Test message")).toBeInTheDocument();
      });

      const clearButton = screen.getByRole("button", { name: /clear/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(screen.queryByText("Test message")).not.toBeInTheDocument();
      });
    });
  });
});
