import type { UIMessage } from "ai";

import { useChat } from "@ai-sdk/react";
import { logger } from "@alfred/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DefaultChatTransport } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TRPCAppRouter } from "@/utils/trpc";

import { useServerUrl, useTrpcClient } from "@/lib/api";
import { useAuthClient } from "@/lib/auth-client";
import { getCookieFromAuthClient } from "@/lib/voice/cookie";
import { useVoiceSessionNative } from "@/lib/voice/session";

export type AgentType = "assistant" | "orchestrator";

function conversationStorageKey(
  agent: AgentType,
  serverUrl: string | undefined
): string {
  const url = typeof serverUrl === "string" ? serverUrl : "unknown";
  return `alfred.ai.${agent}.conversationId.${url}`;
}

export function useChatLogic() {
  const authClient = useAuthClient();
  const { serverUrl } = useServerUrl();
  const trpcClient = useTrpcClient<TRPCAppRouter>();
  const [currentAgent, setCurrentAgent] = useState<AgentType>("assistant");
  const { data: session } = authClient.useSession();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  type FetchArgs = Parameters<typeof globalThis.fetch>;

  const apiEndpoint = useMemo(
    () => `${serverUrl ?? ""}/api/${currentAgent}`,
    [currentAgent, serverUrl]
  );

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    const cookies = getCookieFromAuthClient(authClient);
    if (cookies) {
      h.Cookie = cookies;
    }
    return h;
  }, [session]);

  const transport = useMemo(() => {
    const agentAtTime = currentAgent;
    return new DefaultChatTransport({
      api: apiEndpoint,
      headers,
      fetch: (async (input: FetchArgs[0], init?: FetchArgs[1]) => {
        const storageKey = conversationStorageKey(
          agentAtTime,
          serverUrl ?? undefined
        );

        const updatedInit = (() => {
          if (!init?.body || typeof init.body !== "string") {
            return init;
          }
          try {
            const parsed = JSON.parse(init.body) as Record<string, unknown>;
            const cid = conversationIdRef.current;
            if (cid && typeof parsed.conversationId !== "string") {
              parsed.conversationId = cid;
              return { ...init, body: JSON.stringify(parsed) };
            }
          } catch {
            // ignore
          }
          return init;
        })();

        const response = (await (
          expoFetch as unknown as typeof globalThis.fetch
        )(input, updatedInit)) as Response;

        const nextConversationId = response.headers.get("x-conversation-id");
        if (
          nextConversationId &&
          nextConversationId.length > 0 &&
          conversationIdRef.current !== nextConversationId
        ) {
          conversationIdRef.current = nextConversationId;
          setConversationId(nextConversationId);
          void AsyncStorage.setItem(storageKey, nextConversationId);
        }

        return response;
      }) as unknown as typeof globalThis.fetch,
    });
  }, [apiEndpoint, headers]);

  const chat = useChat({
    id: `chat-${currentAgent}`, // Unique ID per agent type
    transport,
    onError: (err) => {
      logger.error("chat_error", { error: err });
    },
  });

  // Hydration
  useEffect(() => {
    const hydrate = async () => {
      const storageKey = conversationStorageKey(
        currentAgent,
        serverUrl ?? undefined
      );

      try {
        const storedId = await AsyncStorage.getItem(storageKey);
        if (!storedId) {
          chat.setMessages([]);
          setConversationId(null);
          return;
        }

        setConversationId(storedId);
        conversationIdRef.current = storedId;

        const cookies = getCookieFromAuthClient(authClient);
        if (!(cookies && serverUrl)) {
          return;
        }

        const res = await expoFetch(
          `${serverUrl}/api/conversation/${storedId}`,
          {
            headers: { Cookie: cookies },
          }
        );
        if (!res.ok) {
          return;
        }

        const json = (await res.json()) as { messages?: unknown };
        const loaded = json.messages;
        if (Array.isArray(loaded)) {
          chat.setMessages(loaded as UIMessage[]);
        }
      } finally {
        setIsHydrating(false);
      }
    };

    void hydrate();
  }, [currentAgent, serverUrl]);

  const voice = useVoiceSessionNative(trpcClient, {
    surface: "native",
    getCookie: () => getCookieFromAuthClient(authClient),
    baseUrl: serverUrl,
  });

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
    const storageKey = conversationStorageKey(
      currentAgent,
      serverUrl ?? undefined
    );
    void AsyncStorage.removeItem(storageKey);
    setConversationId(null);
    conversationIdRef.current = null;
    chat.setMessages([]);
  }, [chat, currentAgent, serverUrl]);

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
      setCurrentAgent(agent);
    },
    [chat, currentAgent]
  );

  return {
    messages: chat.messages,
    isLoading: chat.status === "streaming" || chat.status === "submitted",
    error: chat.error,
    currentAgent,
    conversationId,
    isHydrating,
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
