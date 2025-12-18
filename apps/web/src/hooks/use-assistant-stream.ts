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
  onResponse?: (response: Response) => void;
  initialMessages?: AssistantUIMessage[];
  initialConversationId?: string | null;
  api?: string;
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
  addToolResult: (result: { toolCallId: string; result: unknown }) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toArgs(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

// Type guards for ALFRED's custom part types (see AGENTS.md AI SDK v6 section)
function isToolCallPart(
  part: unknown
): part is {
  type: "tool-call";
  toolCallId: string;
  toolName?: string;
  input?: unknown;
} {
  return (
    isRecord(part) &&
    part.type === "tool-call" &&
    typeof part.toolCallId === "string"
  );
}

function isToolResultPart(
  part: unknown
): part is {
  type: "tool-result";
  toolCallId: string;
  toolName?: string;
  output?: unknown;
} {
  return (
    isRecord(part) &&
    part.type === "tool-result" &&
    typeof part.toolCallId === "string"
  );
}

export function deriveActions(
  messages: AssistantUIMessage[]
): AssistantAction[] {
  const actionMap = new Map<string, AssistantAction>();

  for (const message of messages) {
    // Cast parts to unknown[] to use type guards for ALFRED's custom part types
    const parts = message.parts as unknown[];
    for (const part of parts) {
      if (isToolCallPart(part)) {
        const args = toArgs(part.input);
        const existing = actionMap.get(part.toolCallId);
        const base: AssistantAction = existing ?? {
          id: part.toolCallId,
          name: part.toolName ?? "tool",
          args,
          status: "running",
        };
        actionMap.set(part.toolCallId, {
          ...base,
          args,
          status: existing?.status === "completed" ? "completed" : "running",
        });
      }

      if (isToolResultPart(part)) {
        const existing = actionMap.get(part.toolCallId);
        actionMap.set(part.toolCallId, {
          id: part.toolCallId,
          name: existing?.name ?? part.toolName ?? "tool",
          args: existing?.args ?? {},
          status: "completed",
          result: part.output,
        });
      }
    }
  }

  return Array.from(actionMap.values());
}

export function useAssistantStream(
  options: UseAssistantStreamOptions = {}
): UseAssistantStreamReturn {
  const {
    onError,
    initialMessages,
    initialConversationId,
    onResponse,
    api: apiBase = "/api/assistant",
  } = options;
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null
  );
  const conversationIdRef = useRef<string | undefined>(
    initialConversationId ?? undefined
  );
  const mountedRef = useRef(true);
  const trackedFetch = useCallback(
    async (
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
      if (onResponse) {
        onResponse(response);
      }
      return response;
    },
    [onResponse]
  );

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    conversationIdRef.current = initialConversationId ?? undefined;
    setConversationId(initialConversationId ?? null);
  }, [apiBase, initialConversationId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiBase,
        // Custom fetch wrapper for conversation ID tracking
        fetch: trackedFetch as typeof fetch,
        prepareSendMessagesRequest: ({ body }) => ({
          body: {
            ...(body ?? {}),
            conversationId: conversationIdRef.current,
          },
        }),
      }),
    [apiBase, trackedFetch]
  );

  // Cast messages for AI SDK compatibility - ALFRED's AssistantUIMessage extends UIMessage
  const chat = useChat({
    transport,
    onError,
  });

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      chat.setMessages(
        initialMessages as Parameters<typeof chat.setMessages>[0]
      );
    }
    // We only want to run this when initialMessages changes.
  }, [chat, initialMessages]);

  useEffect(() => {
    if (chat.error && onError) {
      onError(chat.error);
    }
  }, [chat.error, onError]);

  const actions = useMemo(
    () => deriveActions(chat.messages as AssistantUIMessage[]),
    [chat.messages]
  );

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
      // Cast for AI SDK compatibility
      chat.setMessages(messages as Parameters<typeof chat.setMessages>[0]);
    },
    [chat]
  );

  const addToolResult = useCallback(
    (result: { toolCallId: string; result: unknown }) => {
      chat.addToolResult({
        tool: "unknown",
        toolCallId: result.toolCallId,
        output: result.result,
      });
    },
    [chat]
  );

  return {
    messages: chat.messages as AssistantUIMessage[],
    actions,
    status: chat.status,
    error: chat.error ?? null,
    send,
    clear,
    hydrate,
    conversationId,
    addToolResult,
  };
}
