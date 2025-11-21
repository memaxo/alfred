import { mock, vi } from "bun:test";
import type { AssistantUIMessage } from "@alfred/agent";
import { uiMessageSchema } from "@alfred/type/stream.zod";
import type { Dispatch, SetStateAction } from "react";

const stateHandlers: {
  setMessages?: Dispatch<SetStateAction<AssistantUIMessage[]>>;
  setError?: Dispatch<SetStateAction<Error | null>>;
  setStatus?: Dispatch<SetStateAction<string>>;
} = {};

function ensureAssistantMessage(
  message: AssistantUIMessage
): AssistantUIMessage {
  const result = uiMessageSchema.safeParse(message);
  if (!result.success) {
    throw new Error(`assistant_message_invalid: ${result.error.message}`);
  }
  return result.data as AssistantUIMessage;
}

export const assistantChatMock = {
  sendSpy: vi.fn<(text: string) => void>(),
  reset() {
    this.sendSpy.mockReset();
  },
  emitAssistantMessage(message: AssistantUIMessage) {
    const sanitized = ensureAssistantMessage(message);
    stateHandlers.setMessages?.((prev) => [...prev, sanitized]);
  },
  emitError(error: Error) {
    stateHandlers.setError?.(() => error);
  },
  setStatus(status: string) {
    stateHandlers.setStatus?.(() => status);
  },
};

mock.module("ai", () => ({
  DefaultChatTransport: class MockTransport {
    constructor(public options: Record<string, unknown> = {}) {}
  },
}));

mock.module("@ai-sdk/react", () => {
  const { useEffect, useState } = require("react") as typeof import("react");

  return {
    useChat: (init?: { messages?: AssistantUIMessage[] }) => {
      const [messages, setMessages] = useState<AssistantUIMessage[]>(
        () => init?.messages ?? []
      );
      const [error, setError] = useState<Error | null>(null);
      const [status, setStatus] = useState<string>("ready");

      useEffect(() => {
        stateHandlers.setMessages = setMessages;
        stateHandlers.setError = setError;
        stateHandlers.setStatus = setStatus;
        return () => {
          stateHandlers.setMessages = undefined;
          stateHandlers.setError = undefined;
          stateHandlers.setStatus = undefined;
        };
      }, []);

      const sendMessage = async ({ text }: { text: string }) => {
        assistantChatMock.sendSpy(text);
        setStatus("streaming");
        const userMessage = ensureAssistantMessage({
          id: `user-${Math.random().toString(36).slice(2)}`,
          role: "user",
          parts: [{ type: "text", text }],
          metadata: { status: "sent" },
        });
        setMessages((prev) => [...prev, userMessage]);
        setStatus("ready");
        return { id: userMessage.id };
      };

      const clearError = () => setError(null);

      return {
        messages,
        setMessages,
        status,
        error,
        sendMessage,
        clearError,
      };
    },
  };
});
