import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "@alfred/type/stream";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo } from "react";

export type AssistantActionStatus =
  | "pending"
  | "running"
  | "completed"
  | "error";

export type AssistantAction = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: AssistantActionStatus;
  result?: unknown;
  error?: string;
};

type UseAssistantStreamOptions = {
  onError?: (error: Error) => void;
};

export type UseAssistantStreamReturn = {
  messages: UIMessage[];
  actions: AssistantAction[];
  status: string;
  error: Error | null;
  send: (text: string) => void;
  clear: () => void;
  hydrate: (messages: UIMessage[]) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toArgs(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function deriveActions(messages: UIMessage[]): AssistantAction[] {
  const actionMap = new Map<string, AssistantAction>();

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "tool-call") {
        const toolCallPart = part as {
          toolCallId: string;
          toolName?: string;
          input?: unknown;
        };
        const args = toArgs(toolCallPart.input);
        const existing = actionMap.get(toolCallPart.toolCallId);
        const base: AssistantAction = existing ?? {
          id: toolCallPart.toolCallId,
          name: toolCallPart.toolName ?? "tool",
          args,
          status: "running",
        };
        actionMap.set(toolCallPart.toolCallId, {
          ...base,
          args,
          status: existing?.status === "completed" ? "completed" : "running",
        });
      }

      if (part.type === "tool-result") {
        const toolResultPart = part as {
          toolCallId: string;
          toolName?: string;
          output?: unknown;
        };
        const existing = actionMap.get(toolResultPart.toolCallId);
        actionMap.set(toolResultPart.toolCallId, {
          id: toolResultPart.toolCallId,
          name: existing?.name ?? toolResultPart.toolName ?? "tool",
          args: existing?.args ?? {},
          status: "completed",
          result: toolResultPart.output,
        });
      }
    }
  }

  return Array.from(actionMap.values());
}

export function useAssistantStream(
  options: UseAssistantStreamOptions = {}
): UseAssistantStreamReturn {
  const { onError } = options;

  const chat = useChat<UIMessage>({
    transport: new DefaultChatTransport({ api: "/api/assistant" }),
    onError,
  });

  useEffect(() => {
    if (chat.error && onError) {
      onError(chat.error);
    }
  }, [chat.error, onError]);

  const actions = useMemo(() => deriveActions(chat.messages), [chat.messages]);

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) {
        return;
      }
      void chat.sendMessage({ text });
    },
    [chat]
  );

  const clear = useCallback(() => {
    chat.setMessages([]);
    chat.clearError();
  }, [chat]);

  const hydrate = useCallback(
    (messages: UIMessage[]) => {
      chat.setMessages(messages);
    },
    [chat]
  );

  return {
    messages: chat.messages,
    actions,
    status: chat.status,
    error: chat.error ?? null,
    send,
    clear,
    hydrate,
  };
}
