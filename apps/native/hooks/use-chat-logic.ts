import { useChat } from "@ai-sdk/react";
import { useCallback, useState, useMemo, useEffect } from "react";
import { useVoiceSessionNative } from "@/lib/voice/session";
import { trpcClient } from "@/utils/trpc";
import { authClient } from "@/lib/auth-client";
import { logger } from "@alfred/logger";

export type AgentType = "assistant" | "orchestrator";

export function useChatLogic() {
  const [currentAgent, setCurrentAgent] = useState<AgentType>("assistant");
  
  const apiEndpoint = useMemo(() => {
    return `${process.env.EXPO_PUBLIC_SERVER_URL}/api/${currentAgent}`;
  }, [currentAgent]);

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    const cookies = authClient.getCookie();
    if (cookies) {
      h["Cookie"] = cookies;
    }
    return h;
  }, []);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    append,
    reload,
    stop,
  } = useChat({
    api: apiEndpoint,
    headers,
    onError: (err) => {
      logger.error("chat_error", { error: err });
    },
  });

  const voice = useVoiceSessionNative(trpcClient, { surface: "native" });

  // Handle voice transcript
  useEffect(() => {
    if (voice.stream?.status === "idle" && voice.stream.transcript) {
      const text = voice.stream.transcript.trim();
      if (text.length > 0) {
        append({
          role: "user",
          content: text,
        });
      }
    }
  }, [voice.stream?.status, voice.stream?.transcript, append]);

  const toggleVoice = useCallback(async () => {
    if (voice.stream?.isActive) {
      await voice.stream.stop();
    } else {
      await voice.stream.start();
    }
  }, [voice]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const handleSend = useCallback((text: string) => {
    append({
      role: "user",
      content: text,
    });
  }, [append]);

  return {
    messages,
    input,
    isLoading,
    error,
    currentAgent,
    setAgent: setCurrentAgent,
    handleSend,
    toggleVoice,
    isRecording: voice.stream?.isActive,
    clearMessages,
    stop,
    reload,
  };
}
