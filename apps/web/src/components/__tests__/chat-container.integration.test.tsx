import "@/test/dom";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { AssistantUIMessage } from "@alfred/agent";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { assistantChatMock } from "@/test/mock-assistant-chat";

mock.module("react-virtuoso", () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: AssistantUIMessage[];
    itemContent: (index: number, message: AssistantUIMessage) => ReactNode;
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

mock.module("@/hooks/use-voice-capture", () => ({
  useVoiceCapture: () => ({
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    error: null,
  }),
}));

const { ChatContainer } = await import("../chat-container");

describe("ChatContainer integration", () => {
  beforeEach(() => {
    assistantChatMock.reset();
  });

  it("renders assistant stream messages", async () => {
    const { getByText } = render(<ChatContainer agent="assistant" />);

    await act(async () => {
      assistantChatMock.emitAssistantMessage({
        id: "msg-assistant",
        role: "assistant",
        parts: [{ type: "text", text: "Hi from stream" }],
      });
    });

    await waitFor(() => {
      expect(getByText("Hi from stream")).toBeTruthy();
    });
  });

  it("clears messages when the clear button is pressed", async () => {
    const { getByText, queryByText, getAllByRole } = render(
      <ChatContainer agent="assistant" />
    );

    await act(async () => {
      assistantChatMock.emitAssistantMessage({
        id: "msg-clear",
        role: "assistant",
        parts: [{ type: "text", text: "To clear" }],
      });
    });

    await waitFor(() => {
      expect(getByText("To clear")).toBeTruthy();
    });

    const clearButtons = getAllByRole("button", { name: /clear/i });
    fireEvent.click(clearButtons[clearButtons.length - 1]);

    await waitFor(() => {
      expect(queryByText("To clear")).toBeNull();
    });
  });

  it("hydrates saved messages when switching agents", async () => {
    const { getByText, queryByText, getAllByRole } = render(
      <ChatContainer agent="assistant" />
    );

    await act(async () => {
      assistantChatMock.emitAssistantMessage({
        id: "msg-agent",
        role: "assistant",
        parts: [{ type: "text", text: "Agent state" }],
      });
    });

    await waitFor(() => {
      expect(getByText("Agent state")).toBeTruthy();
    });

    const orchestratorSwitches = getAllByRole("tab", {
      name: /orchestrator/i,
    });
    fireEvent.click(orchestratorSwitches[orchestratorSwitches.length - 1]);

    await waitFor(() => {
      expect(queryByText("Agent state")).toBeNull();
    });

    const assistantSwitches = getAllByRole("tab", { name: /^assistant$/i });
    fireEvent.click(assistantSwitches[assistantSwitches.length - 1]);

    await waitFor(() => {
      expect(getByText("Agent state")).toBeTruthy();
    });
  });

  it("renders initial messages", () => {
    const initial: AssistantUIMessage[] = [
      {
        id: "init-1",
        role: "assistant",
        parts: [{ type: "text", text: "Persisted hello" }],
      },
    ];

    const { getByText } = render(
      <ChatContainer agent="assistant" initialMessages={initial} />
    );

    expect(getByText("Persisted hello")).toBeTruthy();
  });
});
