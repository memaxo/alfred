import type { AssistantUIMessage } from "@alfred/agent";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { useMindscapeStore } from "@/store/mindscape";

type UseChatLogicProps = {
  initialAgent?: "assistant" | "orchestrator";
  initialMessages?: AssistantUIMessage[];
  initialConversationId?: string | null;
};

import { dispatchMindscapeEvent } from "@/hooks/use-mindscape-activations";
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
            const dbIds = data.paths.flat() as string[];
            const state = useMindscapeStore.getState();
            
            // Map DB IDs to UI IDs
            dbIds.forEach(dbId => {
                const node = state.nodes.find(
                  (n) => n.data?.graph?.dbId === dbId || n.id === dbId
                );
                
                if (node) {
                    // Pulse the node as an output (it was activated/touched)
                    state.triggerNodeActivity(node.id, "output");
                    
                    // Also dispatch event for potential edge activation if we knew source
                    // For now, just node activation is safer than guessing edges
                    dispatchMindscapeEvent({
                        type: "rag-retrieval",
                        targetId: node.id
                    });
                }
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
