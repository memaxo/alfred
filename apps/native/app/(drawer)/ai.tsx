import { useChat } from "@ai-sdk/react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";

const generateAPIUrl = (relativePath: string) => {
  const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL;
  if (!serverUrl) {
    throw new Error(
      "EXPO_PUBLIC_SERVER_URL environment variable is not defined"
    );
  }

  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return serverUrl.concat(path);
};

function friendlyChatError(message: string): string {
  if (message.includes("ai_api_key_missing")) {
    return "AI is not configured on the server yet. Set AI_GATEWAY_API_KEY or OPENAI_API_KEY on the server and restart it.";
  }
  if (message.includes("session_required")) {
    return "Your session expired. Please sign in again.";
  }
  return message;
}

function conversationStorageKey(serverUrl: string | undefined): string {
  const url = typeof serverUrl === "string" ? serverUrl : "unknown";
  return `alfred.ai.conversationId.${url}`;
}

export default function AIScreen() {
  const { data: session } = authClient.useSession();
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  type FetchArgs = Parameters<typeof globalThis.fetch>;

  const {
    messages,
    error: chatError,
    sendMessage,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      fetch: (async (input: FetchArgs[0], init?: FetchArgs[1]) => {
        const storageKey = conversationStorageKey(
          process.env.EXPO_PUBLIC_SERVER_URL
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
        if (nextConversationId && nextConversationId.length > 0) {
          if (conversationIdRef.current !== nextConversationId) {
            conversationIdRef.current = nextConversationId;
            setConversationId(nextConversationId);
            void AsyncStorage.setItem(storageKey, nextConversationId);
          }
        }

        return response;
      }) as unknown as typeof globalThis.fetch,
      api: generateAPIUrl("/api/assistant"),
      headers: () => {
        const cookies = authClient.getCookie();
        const headers: Record<string, string> = {};
        if (cookies) {
          headers.Cookie = cookies;
        }
        return headers;
      },
    }),
    onError: (caughtError) => {
      Alert.alert("AI Chat Error", friendlyChatError(caughtError.message));
    },
  });

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const hydrate = async () => {
      const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL;
      const storageKey = conversationStorageKey(serverUrl);

      try {
        const storedId = await AsyncStorage.getItem(storageKey);
        if (!storedId) {
          return;
        }

        setConversationId(storedId);
        conversationIdRef.current = storedId;

        // Load messages from server to restore chat across app restarts.
        const cookies = authClient.getCookie();
        if (!cookies || !serverUrl) {
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
          setMessages(loaded as UIMessage[]);
        }
      } finally {
        setIsHydrating(false);
      }
    };

    void hydrate();
  }, [setMessages]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  if (!session?.user) {
    return <Redirect href="/(drawer)/" />;
  }

  const onSubmit = () => {
    const value = input.trim();
    if (value) {
      sendMessage({ text: value });
      setInput("");
    }
  };

  const subtitle = useMemo(() => {
    if (isHydrating) {
      return "Loading history...";
    }
    return "Chat with our AI assistant";
  }, [isHydrating]);

  return (
    <Container>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-4 py-6">
          <View className="mb-6">
            <Text className="mb-2 font-bold text-2xl text-foreground">
              AI Chat
            </Text>
            <Text className="text-muted-foreground">
              {subtitle}
            </Text>
          </View>

          {chatError && (
            <View className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <Text className="text-destructive text-sm">
                {friendlyChatError(chatError.message)}
              </Text>
              <Text className="mt-1 text-muted-foreground text-xs">
                You can keep typing and retry sending.
              </Text>
            </View>
          )}

          <ScrollView
            className="mb-4 flex-1"
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View className="flex-1 items-center justify-center">
                <Text className="text-center text-lg text-muted-foreground">
                  Ask me anything to get started!
                </Text>
              </View>
            ) : (
              <View className="space-y-4">
                {messages.map((message) => (
                  <View
                    className={`rounded-lg p-3 ${
                      message.role === "user"
                        ? "ml-8 bg-primary/10"
                        : "mr-8 border border-border bg-card"
                    }`}
                    key={message.id}
                  >
                    <Text className="mb-1 font-semibold text-foreground text-sm">
                      {message.role === "user" ? "You" : "AI Assistant"}
                    </Text>
                    <View className="space-y-1">
                      {message.parts.map((part, i) => {
                        if (part.type === "text") {
                          return (
                            <Text
                              className="text-foreground leading-relaxed"
                              key={`${message.id}-${i}`}
                            >
                              {part.text}
                            </Text>
                          );
                        }
                        // Most non-text parts are stream protocol metadata (step starts, etc).
                        // Keep the UI clean by default.
                        if (
                          part.type === "tool-call" ||
                          part.type === "tool-result" ||
                          part.type === "reasoning"
                        ) {
                          if (!__DEV__) {
                            return null;
                          }
                          return (
                            <Text
                              className="font-mono text-muted-foreground text-xs"
                              key={`${message.id}-${i}`}
                            >
                              {JSON.stringify(part)}
                            </Text>
                          );
                        }
                        return null;
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View className="border-border border-t pt-4">
            <View className="flex-row items-end space-x-2">
              <TextInput
                autoFocus={true}
                className="max-h-[120px] min-h-[40px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
                onChangeText={setInput}
                onSubmitEditing={(e) => {
                  e.preventDefault();
                  onSubmit();
                }}
                placeholder="Type your message..."
                placeholderTextColor="#6b7280"
                value={input}
              />
              <TouchableOpacity
                className={`rounded-md p-2 ${
                  input.trim() ? "bg-primary" : "bg-muted"
                }`}
                disabled={!input.trim()}
                onPress={onSubmit}
              >
                <Ionicons
                  color={input.trim() ? "#ffffff" : "#6b7280"}
                  name="send"
                  size={20}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Container>
  );
}
