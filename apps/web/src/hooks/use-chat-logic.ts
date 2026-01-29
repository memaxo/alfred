import type { UIMessage } from "@alfred/type/stream";

type AssistantUIMessage = UIMessage;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { useDesktopStore } from "@/store/desktop";

interface UseChatLogicProps {
  initialAgent?: "assistant" | "orchestrator";
  initialMessages?: AssistantUIMessage[];
  initialConversationId?: string | null;
}

import { dispatchDesktopEvent } from "@/hooks/use-desktop-activations";
import { useFocusedContext } from "@/hooks/use-focused-context";

export function useChatLogic({
  initialAgent = "assistant",
  initialMessages,
  initialConversationId,
}: UseChatLogicProps = {}) {
  const focused = useFocusedContext();
  const [currentAgent, setCurrentAgent] = useState<
    "assistant" | "orchestrator"
  >(initialAgent);
  const contextsRef = useRef<Map<string, AssistantUIMessage[]>>(new Map());
  const conversationIdsRef = useRef(
    new Map<"assistant" | "orchestrator", string | null>([
      [initialAgent, initialConversationId ?? null],
    ])
  );
  const [seedConversationId, setSeedConversationId] = useState<string | null>(
    initialConversationId ?? null
  );
  const pendingReloadRef = useRef(false);
  const apiBase =
    currentAgent === "assistant" ? "/api/assistant" : "/api/orchestrator";

  const handleResponse = useCallback((response: Response) => {
    const header = response.headers.get("x-mindscape-activation");
    if (header) {
      try {
        const data = JSON.parse(header);
        if (data && Array.isArray(data.paths)) {
          const paths = data.paths as string[][];
          const state = useDesktopStore.getState();

          const resolveId = (dbId: string) => {
            const window = state.windows.find(
              (w) => w.data?.resourceRef?.id === dbId || w.id === dbId
            );
            return window?.id;
          };

          paths.forEach((path, pathIndex) => {
            const pathDelay = pathIndex * 200;

            path.forEach((nodeId, i) => {
              const uiId = resolveId(nodeId);
              if (!uiId) {
                return;
              }

              setTimeout(
                () => {
                  dispatchDesktopEvent({
                    type: "context-cache",
                    sourceId: uiId,
                  });
                },
                pathDelay + i * 150
              );

              if (i < path.length - 1) {
                const nextNodeId = path[i + 1];
                const nextUiId = nextNodeId ? resolveId(nextNodeId) : undefined;
                if (nextUiId) {
                  setTimeout(
                    () => {
                      dispatchDesktopEvent({
                        type: "rag-retrieval",
                        sourceId: uiId,
                        targetId: nextUiId,
                      });
                    },
                    pathDelay + i * 150
                  );
                }
              }
            });
          });
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const {
    messages,
    actions,
    status,
    error,
    send,
    reload,
    clear,
    hydrate,
    setMessages,
    conversationId,
    addToolApprovalResponse,
  } = useAssistantStream({
    api: apiBase,
    onError: (_err) => {
      // Error is already displayed in the error state
      // Additional logging handled by error boundaries
    },
    onResponse: handleResponse,
    initialMessages,
    initialConversationId: seedConversationId,
  });

  useEffect(() => {
    conversationIdsRef.current.set(currentAgent, conversationId);
  }, [conversationId, currentAgent]);

  // Handle pending reload after message edit
  useEffect(() => {
    if (pendingReloadRef.current && status !== "streaming") {
      pendingReloadRef.current = false;
      reload();
    }
  }, [messages, status, reload]);

  const {
    isRecording,
    startRecording,
    stopRecording,
    error: voiceError,
  } = useVoiceCapture({
    onTranscript: (text) => {
      if (currentAgent === "assistant" && text.trim().length > 0) {
        handleSend(text);
      }
    },
    onError: (_err) => {
      // Voice errors are handled by the hook
    },
  });

  const activeActions = useMemo(
    () =>
      actions.filter(
        (action) => action.status === "pending" || action.status === "running"
      ),
    [actions]
  );

  const handleSend = useCallback(
    (input: string) => {
      // Inject context if available
      if (focused.content) {
        const contextBlock = `\n\n[System: User is focusing on ${focused.nodeType} "${focused.label}"]\nContext:\n${focused.content}`;
        // We append context to the user message, hidden or visible?
        // Visible is better for transparency.
        // But for UX, maybe just send clean input and let the hook handle system message injection?
        // The useAssistantStream hook takes a string.
        // Let's append it invisibly or visibly.
        // Ideally, we send it as a separate system message or part, but the hook likely expects just user input.
        // Let's append it.
        send(`${input}${contextBlock}`);
      } else {
        send(input);
      }
    },
    [send, focused]
  );

  const handleAgentChange = useCallback(
    (nextAgent: "assistant" | "orchestrator") => {
      if (nextAgent === currentAgent) {
        return;
      }
      conversationIdsRef.current.set(currentAgent, conversationId);
      contextsRef.current.set(currentAgent, messages);
      clear();
      setCurrentAgent(nextAgent);
      setSeedConversationId(conversationIdsRef.current.get(nextAgent) ?? null);
      const snapshot = contextsRef.current.get(nextAgent);
      if (snapshot) {
        hydrate(snapshot);
      }
    },
    [clear, conversationId, currentAgent, hydrate, messages]
  );

  const toggleVoice = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleRegenerate = useCallback(() => {
    reload();
  }, [reload]);

  const handleEdit = useCallback(
    (messageId: string, newText: string) => {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index === -1) {
        return;
      }

      const message = messages[index];
      if (!message) {
        return;
      }
      if (message.role !== "user") {
        return;
      }

      // Update the message and remove subsequent ones
      const newMessages = messages.slice(0, index);
      const editedMessage: AssistantUIMessage = {
        ...message,
        parts: [{ type: "text", text: newText }],
      };

      setMessages([...newMessages, editedMessage]);

      // Trigger regeneration in useEffect after state sync
      pendingReloadRef.current = true;
    },
    [messages, setMessages]
  );

  return {
    currentAgent,
    messages,
    actions,
    activeActions,
    status,
    error,
    voiceError,
    isRecording,
    handleSend,
    handleRegenerate,
    handleEdit,
    handleAgentChange,
    toggleVoice,
    clear,
    hydrate,
    conversationId,
    addToolApprovalResponse,
  };
}
