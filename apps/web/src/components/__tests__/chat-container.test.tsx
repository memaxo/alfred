import "@/test/dom";
import { afterEach, describe, expect, it, mock, vi } from "bun:test";
import type { AssistantUIMessage } from "@alfred/agent";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";
import {
  useCallback as reactUseCallback,
  useState as reactUseState,
} from "react";

mock.module("@alfred/voice/audio", () => ({
  arrayBufferToBase64: vi.fn(() => ""),
}));

mock.module("@/hooks/use-focused-context", () => ({
  useFocusedContext: () => ({
    label: null,
    isError: false,
    isLoading: false,
    ragDocuments: [],
    content: null,
    nodeType: null,
  }),
}));

const submitFeedbackMock = vi.fn();
const resetFeedbackMock = vi.fn();
mock.module("@/hooks/use-cognitive-feedback", () => ({
  useCognitiveFeedback: () => ({
    submit: submitFeedbackMock,
    status: "idle",
    error: null,
    reset: resetFeedbackMock,
  }),
}));

afterEach(() => {
  submitFeedbackMock.mockReset();
  resetFeedbackMock.mockReset();
});

mock.module("@alfred/ui", () => ({
  Chat: ({
    messages,
    onSend,
    placeholder = "Ask Alfred how to help…",
    disabled,
    renderPart,
    renderMessageActions,
  }: {
    messages: AssistantUIMessage[];
    onSend: (text: string) => void;
    placeholder?: string;
    disabled?: boolean;
    renderPart?: (
      part: AssistantUIMessage["parts"][number],
      message: AssistantUIMessage
    ) => ReactNode | null;
    renderMessageActions?: (message: AssistantUIMessage) => ReactNode | null;
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
              {renderMessageActions ? (
                <div data-testid="mock-chat-actions">
                  {renderMessageActions(message)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <input
            aria-label="assistant-input"
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            value={value}
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

  const streamState: {
    messages: AssistantUIMessage[];
    send?: (text: string) => void;
    clear?: () => void;
    hydrate?: (snapshot: AssistantUIMessage[]) => void;
  } = {
    messages: [],
  };

  return {
    useAssistantStream: () => {
      const [messages, setMessages] = reactUseState<AssistantUIMessage[]>(
        streamState.messages
      );

      const setAndTrack = reactUseCallback(
        (
          updater:
            | AssistantUIMessage[]
            | ((prev: AssistantUIMessage[]) => AssistantUIMessage[])
        ) => {
          setMessages((prev) => {
            const next =
              typeof updater === "function"
                ? (
                    updater as (
                      prev: AssistantUIMessage[]
                    ) => AssistantUIMessage[]
                  )(prev)
                : updater;
            streamState.messages = next;
            return next;
          });
        },
        []
      );

      const send = reactUseCallback(
        (text: string) => {
          setAndTrack((prev) => [...prev, createMessage(text)]);
        },
        [setAndTrack]
      );
      const clear = reactUseCallback(() => {
        setAndTrack([]);
      }, [setAndTrack]);
      const hydrate = reactUseCallback(
        (snapshot: AssistantUIMessage[]) => {
          setAndTrack(snapshot);
        },
        [setAndTrack]
      );

      streamState.send = send;
      streamState.clear = clear;
      streamState.hydrate = hydrate;

      return {
        messages,
        actions: [],
        status: "ready",
        error: null,
        send,
        clear,
        hydrate,
        conversationId: "test-conv-id",
        addToolResult: vi.fn(),
      };
    },
    assistantStreamTestApi: {
      getMessages: () => streamState.messages,
      send: (text: string) => streamState.send?.(text),
      clear: () => streamState.clear?.(),
      hydrate: (snapshot: AssistantUIMessage[]) =>
        streamState.hydrate?.(snapshot),
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

const { assistantStreamTestApi } = await import("@/hooks/use-assistant-stream");
const { ChatContainer } = await import("../chat-container");

function getMessageTexts(): string[] {
  return assistantStreamTestApi
    .getMessages()
    .map((message) =>
      message.parts
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("")
    );
}

async function emitAssistantMessage(text: string) {
  await act(async () => {
    assistantStreamTestApi.send(text);
  });
}

function getAgentTab(
  container: HTMLElement,
  agent: "assistant" | "orchestrator"
): HTMLButtonElement {
  const panelId =
    agent === "assistant" ? "assistant-panel" : "orchestrator-panel";
  const candidates = container.querySelectorAll<HTMLButtonElement>(
    `[aria-controls="${panelId}"]`
  );
  if (!candidates.length) {
    throw new Error(`agent tab not found for ${agent}`);
  }
  return candidates[0];
}

function getClearButton(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>(
    '[aria-label="Clear conversation"]'
  );
  if (!btn) {
    throw new Error("clear button not found");
  }
  return btn;
}

describe("ChatContainer", () => {
  describe("agent switching", () => {
    it("saves current state to contextsRef on switch", async () => {
      const { container } = render(<ChatContainer agent="assistant" />);
      await emitAssistantMessage("Test message");

      await waitFor(() => {
        expect(getMessageTexts()).toContain("Test message");
      });

      const agentSwitch = getAgentTab(container, "orchestrator");
      fireEvent.click(agentSwitch);

      await waitFor(() => {
        expect(getMessageTexts()).toHaveLength(0);
      });
    });

    it("hydrates previous state correctly on switch", async () => {
      const { container } = render(<ChatContainer agent="assistant" />);
      await emitAssistantMessage("First message");

      await waitFor(() => {
        expect(getMessageTexts()).toContain("First message");
      });

      const agentSwitch = getAgentTab(container, "orchestrator");
      fireEvent.click(agentSwitch);

      await waitFor(() => {
        expect(getMessageTexts()).toHaveLength(0);
      });

      const assistantSwitch = getAgentTab(container, "assistant");
      fireEvent.click(assistantSwitch);

      await waitFor(() => {
        expect(getMessageTexts()).toContain("First message");
      });
    });

    it("clears current state before switching", async () => {
      const { container } = render(<ChatContainer agent="assistant" />);
      await emitAssistantMessage("Test");

      await waitFor(() => {
        expect(getMessageTexts()).toContain("Test");
      });

      const agentSwitch = getAgentTab(container, "orchestrator");
      fireEvent.click(agentSwitch);

      await waitFor(() => {
        expect(getMessageTexts()).toHaveLength(0);
      });
    });

    it("preserves independent state for multiple agents", async () => {
      const { container } = render(<ChatContainer agent="assistant" />);
      await emitAssistantMessage("Assistant message");

      await waitFor(() => {
        expect(getMessageTexts()).toContain("Assistant message");
      });

      const orchestratorSwitch = getAgentTab(container, "orchestrator");
      fireEvent.click(orchestratorSwitch);

      await waitFor(() => {
        expect(getMessageTexts()).toHaveLength(0);
      });

      const assistantSwitch = getAgentTab(container, "assistant");
      fireEvent.click(assistantSwitch);

      await waitFor(() => {
        expect(getMessageTexts()).toContain("Assistant message");
      });
    });

    it("clear button resets current agent state", async () => {
      const { container } = render(<ChatContainer agent="assistant" />);
      await emitAssistantMessage("Test message");

      await waitFor(() => {
        expect(getMessageTexts()).toContain("Test message");
      });

      const clearButton = getClearButton(container);
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(getMessageTexts()).toHaveLength(0);
      });
    });
  });
});
