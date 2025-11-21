import { useChat } from "@ai-sdk/react";
import type { AssistantUIMessage } from "@alfred/agent";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  initialMessages?: AssistantUIMessage[];
  initialConversationId?: string | null;
};

export type UseAssistantStreamReturn = {
  messages: AssistantUIMessage[];
  actions: AssistantAction[];
  status: string;
  error: Error | null;
  send: (text: string) => void;
  clear: () => void;
  hydrate: (messages: AssistantUIMessage[]) => void;
  conversationId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toArgs(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function deriveActions(
  messages: AssistantUIMessage[]
): AssistantAction[] {
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
  const { onError, initialMessages, initialConversationId } = options;
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null
  );
  const conversationIdRef = useRef<string | undefined>(
    initialConversationId ?? undefined
  );
  const mountedRef = useRef(true);
  const transportRef = useRef<DefaultChatTransport<AssistantUIMessage>>();

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  if (!transportRef.current) {
    const trackedFetch = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      const response = await fetch(input, init);
      const headerId = response.headers.get("x-conversation-id");
      if (headerId) {
        conversationIdRef.current = headerId;
        if (mountedRef.current) {
          setConversationId(headerId);
        }
      }
      return response;
    };

    transportRef.current = new DefaultChatTransport({
      api: "/api/assistant",
      fetch: trackedFetch,
      prepareSendMessagesRequest: ({ body }) => ({
        body: {
          ...(body ?? {}),
          conversationId: conversationIdRef.current,
        },
      }),
    });
  }

  const chat = useChat<AssistantUIMessage>({
    transport: transportRef.current,
    messages: initialMessages ?? [],
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
    (messages: AssistantUIMessage[]) => {
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
    conversationId,
  };
}
