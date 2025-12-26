import { useChat } from "@ai-sdk/react";
import { logger } from "@alfred/logger";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useVoiceSessionNative } from "@/lib/voice/session";
import { trpcClient } from "@/utils/trpc";

export type AgentType = "assistant" | "orchestrator";

export function useChatLogic() {
  const [currentAgent, setCurrentAgent] = useState<AgentType>("assistant");
  const { data: session } = authClient.useSession();

  const apiEndpoint = useMemo(
    () => `${process.env.EXPO_PUBLIC_SERVER_URL}/api/${currentAgent}`,
    [currentAgent]
  );

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    const cookies = authClient.getCookie();
    if (cookies) {
      h.Cookie = cookies;
    }
    return h;
  }, [session]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        headers,
      }),
    [apiEndpoint, headers]
  );

  const chat = useChat({
    transport,
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
        chat.sendMessage({ text });
      }
    }
  }, [voice.stream?.status, voice.stream?.transcript, chat]);

  const toggleVoice = useCallback(async () => {
    if (voice.stream?.isActive) {
      await voice.stream.stop();
    } else {
      await voice.stream.start();
    }
  }, [voice]);

  const clearMessages = useCallback(() => {
    chat.setMessages([]);
  }, [chat]);

  const handleSend = useCallback(
    (text: string) => {
      chat.sendMessage({ text });
    },
    [chat]
  );

  return {
    messages: chat.messages,
    isLoading: chat.status === "streaming" || chat.status === "submitted",
    error: chat.error,
    currentAgent,
    setAgent: setCurrentAgent,
    handleSend,
    toggleVoice,
    isRecording: voice.stream?.isActive,
    clearMessages,
    stop: chat.stop,
    reload: chat.regenerate,
  };
}
