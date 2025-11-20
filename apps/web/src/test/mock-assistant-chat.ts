import type { UIMessage } from "@alfred/type/stream";
import type { Dispatch, SetStateAction } from "react";
import { mock, vi } from "bun:test";

const stateHandlers: {
  setMessages?: Dispatch<SetStateAction<UIMessage[]>>;
  setError?: Dispatch<SetStateAction<Error | null>>;
  setStatus?: Dispatch<SetStateAction<string>>;
} = {};

export const assistantChatMock = {
  sendSpy: vi.fn<(text: string) => void>(),
  reset() {
    this.sendSpy.mockReset();
  },
  emitAssistantMessage(message: UIMessage) {
    stateHandlers.setMessages?.((prev) => [...prev, message]);
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
    constructor(public options: { api: string }) {}
  },
}));

mock.module("@ai-sdk/react", () => {
  const { useEffect, useState } = require("react") as typeof import("react");

  return {
    useChat: () => {
      const [messages, setMessages] = useState<UIMessage[]>([]);
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
        const userMessage: UIMessage = {
          id: `user-${Math.random().toString(36).slice(2)}`,
          role: "user",
          parts: [{ type: "text", text }],
          metadata: { status: "sent" },
        };
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
