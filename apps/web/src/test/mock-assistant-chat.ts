import type { UIMessage as AssistantUIMessage } from "@alfred/type/stream";
import type { Dispatch, SetStateAction } from "react";

import { uiMessageSchema } from "@alfred/type/stream.zod";
import { mock, vi } from "bun:test";

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
  approveSpy:
    vi.fn<(args: { id: string; approved: boolean; reason?: string }) => void>(),
  transportSpy: vi.fn<(options: Record<string, unknown>) => void>(),
  lastTransportOptions: null as Record<string, unknown> | null,
  reset() {
    this.sendSpy.mockReset();
    this.approveSpy.mockReset();
    this.transportSpy.mockReset();
    this.lastTransportOptions = null;
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
    constructor(public options: Record<string, unknown> = {}) {
      assistantChatMock.lastTransportOptions = options;
      assistantChatMock.transportSpy(options);
    }
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

      const sendMessage = ({ text }: { text: string }) => {
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
      const regenerate = () => {
        assistantChatMock.sendSpy("__regenerate__");
      };

      const addToolApprovalResponse = (args: {
        id: string;
        approved: boolean;
        reason?: string;
      }) => {
        assistantChatMock.approveSpy(args);
      };

      return {
        messages,
        setMessages,
        status,
        error,
        sendMessage,
        regenerate,
        addToolApprovalResponse,
        clearError,
      };
    },
  };
});
