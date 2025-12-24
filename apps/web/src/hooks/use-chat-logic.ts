import type { AssistantUIMessage } from "@alfred/agent";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { useDesktopStore } from "@/store/desktop";

type UseChatLogicProps = {
  initialAgent?: "assistant" | "orchestrator";
  initialMessages?: AssistantUIMessage[];
  initialConversationId?: string | null;
};

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
  const apiBase =
    currentAgent === "assistant" ? "/api/assistant" : "/api/orchestrator";

  const {
    messages,
    actions,
    status,
    error,
    send,
    clear,
    hydrate,
    addToolResult,
  } = useAssistantStream({
    api: apiBase,
    onError: (_err) => {
      // Error is already displayed in the error state
      // Additional logging handled by error boundaries
    },
    onResponse: (response) => {
      const header = response.headers.get("x-mindscape-activation");
      if (header) {
        try {
          const data = JSON.parse(header);
          if (data && Array.isArray(data.paths)) {
            const paths = data.paths as string[][];
            const state = useDesktopStore.getState();

            // Helper to resolve DB ID to UI Window ID
            const resolveId = (dbId: string) => {
              const window = state.windows.find(
                (w) => w.data?.resourceRef?.id === dbId || w.id === dbId
              );
              return window?.id;
            };

            // Visualize each path sequentially
            paths.forEach((path, pathIndex) => {
              // Stagger paths slightly if multiple
              const pathDelay = pathIndex * 200;

              path.forEach((nodeId, i) => {
                const uiId = resolveId(nodeId);
                if (!uiId) {
                  return;
                }

                // Pulse the window's connected edges
                setTimeout(
                  () => {
                    dispatchDesktopEvent({
                      type: "context-cache",
                      sourceId: uiId,
                    });
                  },
                  pathDelay + i * 150
                );

                // If there is a next node, pulse the edge between them
                if (i < path.length - 1) {
                  const nextNodeId = path[i + 1];
                  const nextUiId = nextNodeId
                    ? resolveId(nextNodeId)
                    : undefined;
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
        } catch (_e) {
          // ignore
        }
      }
    },
    initialMessages,
    initialConversationId,
  });

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
      if (currentAgent !== "assistant") {
        return;
      }

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
    [currentAgent, send, focused]
  );

  const handleAgentChange = useCallback(
    (nextAgent: "assistant" | "orchestrator") => {
      if (nextAgent === currentAgent) {
        return;
      }
      contextsRef.current.set(currentAgent, messages);
      clear();
      setCurrentAgent(nextAgent);
      const snapshot = contextsRef.current.get(nextAgent);
      if (snapshot) {
        hydrate(snapshot);
      }
    },
    [clear, currentAgent, hydrate, messages]
  );

  const toggleVoice = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

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
    handleAgentChange,
    toggleVoice,
    clear,
    hydrate,
    addToolResult,
  };
}
