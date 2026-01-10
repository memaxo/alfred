import { useChat } from "@ai-sdk/react";
import { logger } from "@alfred/logger";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    id: currentAgent,
    transport,
    onError: (err) => {
      logger.error("chat_error", { error: err });
    },
  });

  const voice = useVoiceSessionNative(trpcClient, { surface: "native" });

  // Voice transcript should send exactly once per "idle" cycle.
  // We reset the guard whenever the stream leaves idle.
  const voiceSentRef = useRef(false);

  // Handle voice transcript
  useEffect(() => {
    if (voice.stream?.status !== "idle") {
      voiceSentRef.current = false;
      return;
    }

    const text = voice.stream.transcript.trim();
    if (text.length === 0 || voiceSentRef.current) {
      return;
    }

    voiceSentRef.current = true;
    chat.sendMessage({ text });
  }, [voice.stream?.status, voice.stream?.transcript, chat.sendMessage]);

  const toggleVoice = useCallback(async () => {
    if (!voice.stream) {
      return;
    }

    if (voice.stream.status === "idle" || voice.stream.status === "error") {
      await voice.stream.start();
      return;
    }

    await voice.stream.stop();
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

  const setAgent = useCallback(
    (agent: AgentType) => {
      if (agent === currentAgent) {
        return;
      }
      chat.stop();
      chat.setMessages([]);
      setCurrentAgent(agent);
    },
    [chat, currentAgent]
  );

  return {
    messages: chat.messages,
    isLoading: chat.status === "streaming" || chat.status === "submitted",
    error: chat.error,
    currentAgent,
    setAgent,
    handleSend,
    toggleVoice,
    isRecording:
      voice.stream?.status !== "idle" && voice.stream?.status !== "error",
    clearMessages,
    stop: chat.stop,
    reload: chat.regenerate,
  };
}
