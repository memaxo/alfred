import "@/test/dom";
import { describe, expect, it, mock, vi } from "bun:test";
import type { AssistantUIMessage } from "@alfred/agent";
import { fireEvent, render, waitFor } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";
import {
  useCallback as reactUseCallback,
  useState as reactUseState,
} from "react";

mock.module("@alfred/voice/audio", () => ({
  arrayBufferToBase64: vi.fn(() => ""),
}));

mock.module("@alfred/ui", () => ({
  Chat: ({
    messages,
    onSend,
    placeholder = "Ask Alfred how to help…",
    disabled,
    renderPart,
  }: {
    messages: AssistantUIMessage[];
    onSend: (text: string) => void;
    placeholder?: string;
    disabled?: boolean;
    renderPart?: (
      part: AssistantUIMessage["parts"][number],
      message: AssistantUIMessage
    ) => ReactNode | null;
  }) => {
    const [value, setValue] = reactUseState("");

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (disabled || !value.trim()) {
        return;
      }
      onSend(value);
      setValue("");
    };

    return (
      <div data-testid="mock-chat">
        <div data-testid="mock-chat-messages">
          {messages.map((message) => (
            <div key={message.id ?? crypto.randomUUID()}>
              {message.parts.map((part, index) => {
                if (renderPart) {
                  const rendered = renderPart(part, message);
                  if (rendered) {
                    return (
                      <span
                        data-testid="mock-chat-rendered"
                        key={`${message.id ?? index}-rendered-${index}`}
                      >
                        {rendered}
                      </span>
                    );
                  }
                }
                if (part.type === "text") {
                  return (
                    <span
                      data-testid="mock-chat-text"
                      key={`${message.id ?? index}-text-${index}`}
                    >
                      {part.text}
                    </span>
                  );
                }
                return null;
              })}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <input
            aria-label="assistant-input"
            disabled={disabled}
            placeholder={placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button disabled={disabled} type="submit">
            Send
          </button>
        </form>
      </div>
    );
  },
}));

mock.module("@/hooks/use-assistant-stream", () => {
  const createMessage = (text: string): AssistantUIMessage => ({
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: "user",
    parts: [{ type: "text", text }],
    metadata: { status: "sent" },
  });

  return {
    useAssistantStream: () => {
      const [messages, setMessages] = reactUseState<AssistantUIMessage[]>([]);
      const send = reactUseCallback((text: string) => {
        setMessages((prev) => [...prev, createMessage(text)]);
      }, []);
      const clear = reactUseCallback(() => {
        setMessages([]);
      }, []);
      const hydrate = reactUseCallback((snapshot: AssistantUIMessage[]) => {
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

mock.module("@/hooks/use-voice-capture", () => ({
  useVoiceCapture: () => ({
    isRecording: false,
    isProcessing: false,
    transcript: "",
    error: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    playAudio: vi.fn(),
    clearTranscript: vi.fn(),
  }),
}));

const { ChatContainer } = await import("../chat-container");

describe("ChatContainer", () => {
  describe("agent switching", () => {
    it("saves current state to contextsRef on switch", async () => {
      const {
        getByPlaceholderText,
        getByRole,
        getByText,
        queryByText,
      } = render(<ChatContainer agent="assistant" />);

      const input = getByPlaceholderText(/Ask Alfred/i);
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.submit(input.closest("form") ?? input);

      await waitFor(() => {
        expect(getByText("Test message")).toBeInTheDocument();
      });

      const agentSwitch = getByRole("button", { name: /orchestrator/i });
      fireEvent.click(agentSwitch);

      await waitFor(() => {
        expect(queryByText("Test message")).not.toBeInTheDocument();
      });
    });

    it("hydrates previous state correctly on switch", async () => {
      const {
        getByPlaceholderText,
        getByRole,
        getByText,
        queryByText,
      } = render(<ChatContainer agent="assistant" />);

      const input = getByPlaceholderText(/Ask Alfred/i);
      fireEvent.change(input, { target: { value: "First message" } });
      fireEvent.submit(input.closest("form") ?? input);

      await waitFor(() => {
        expect(getByText("First message")).toBeInTheDocument();
      });

      const agentSwitch = getByRole("button", { name: /orchestrator/i });
      fireEvent.click(agentSwitch);

      await waitFor(() => {
        expect(queryByText("First message")).not.toBeInTheDocument();
      });

      const assistantSwitch = getByRole("button", {
        name: /assistant/i,
      });
      fireEvent.click(assistantSwitch);

      await waitFor(() => {
        expect(getByText("First message")).toBeInTheDocument();
      });
    });

    it("clears current state before switching", async () => {
      const {
        getByPlaceholderText,
        getByRole,
        getByText,
        queryByText,
      } = render(<ChatContainer agent="assistant" />);

      const input = getByPlaceholderText(/Ask Alfred/i);
      fireEvent.change(input, { target: { value: "Test" } });
      fireEvent.submit(input.closest("form") ?? input);

      await waitFor(() => {
        expect(getByText("Test")).toBeInTheDocument();
      });

      const agentSwitch = getByRole("button", { name: /orchestrator/i });
      fireEvent.click(agentSwitch);

      await waitFor(() => {
        expect(queryByText("Test")).not.toBeInTheDocument();
      });
    });

    it("preserves independent state for multiple agents", async () => {
      const {
        getByPlaceholderText,
        getByRole,
        getByText,
        queryByText,
      } = render(<ChatContainer agent="assistant" />);

      const input = getByPlaceholderText(/Ask Alfred/i);
      fireEvent.change(input, { target: { value: "Assistant message" } });
      fireEvent.submit(input.closest("form") ?? input);

      await waitFor(() => {
        expect(getByText("Assistant message")).toBeInTheDocument();
      });

      const orchestratorSwitch = getByRole("button", {
        name: /orchestrator/i,
      });
      fireEvent.click(orchestratorSwitch);

      await waitFor(() => {
        expect(queryByText("Assistant message")).not.toBeInTheDocument();
      });

      const assistantSwitch = getByRole("button", {
        name: /assistant/i,
      });
      fireEvent.click(assistantSwitch);

      await waitFor(() => {
        expect(getByText("Assistant message")).toBeInTheDocument();
      });
    });

    it("clear button resets current agent state", async () => {
      const {
        getByPlaceholderText,
        getByRole,
        getByText,
        queryByText,
      } = render(<ChatContainer agent="assistant" />);

      const input = getByPlaceholderText(/Ask Alfred/i);
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.submit(input.closest("form") ?? input);

      await waitFor(() => {
        expect(getByText("Test message")).toBeInTheDocument();
      });

      const clearButton = getByRole("button", { name: /clear/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(queryByText("Test message")).not.toBeInTheDocument();
      });
    });
  });
});
