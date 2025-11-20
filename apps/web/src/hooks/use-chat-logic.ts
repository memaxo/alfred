import type { AssistantUIMessage } from "@alfred/agent";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { useVoiceCapture } from "@/hooks/use-voice-capture";

type UseChatLogicProps = {
  initialAgent?: "assistant" | "orchestrator";
  initialMessages?: AssistantUIMessage[];
  initialConversationId?: string | null;
};

export function useChatLogic({
  initialAgent = "assistant",
  initialMessages,
  initialConversationId,
}: UseChatLogicProps = {}) {
  const [currentAgent, setCurrentAgent] = useState<"assistant" | "orchestrator">(
    initialAgent
  );
  const contextsRef = useRef<Map<string, AssistantUIMessage[]>>(new Map());

  const { messages, actions, status, error, send, clear, hydrate } =
    useAssistantStream({
      onError: (_err) => {
        // Error is already displayed in the error state
        // Additional logging handled by error boundaries
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
        send(text);
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
        // Orchestrator streaming disabled: Use /orchestrator/run route for workflow execution.
        // This chat interface is for assistant conversations only.
        return;
      }
      send(input);
    },
    [currentAgent, send]
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
  };
}
