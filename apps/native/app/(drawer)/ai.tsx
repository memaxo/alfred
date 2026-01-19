import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import { useChatLogic } from "@/hooks/use-chat-logic";
import { useAuthClient } from "@/lib/auth-client";

function friendlyChatError(message: string): string {
  if (message.includes("ai_api_key_missing")) {
    return "AI is not configured on the server yet. Set AI_GATEWAY_API_KEY or OPENAI_API_KEY on the server and restart it.";
  }
  if (message.includes("session_required")) {
    return "Your session expired. Please sign in again.";
  }
  return message;
}

export default function AIScreen() {
  const authClient = useAuthClient();
  const { data: session } = authClient.useSession();
  const [input, setInput] = useState("");
  const {
    messages,
    error: chatError,
    handleSend,
    isHydrating,
    isLoading,
  } = useChatLogic();

  const scrollViewRef = useRef<ScrollView>(null);

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
      handleSend(value);
      setInput("");
    }
  };

  const subtitle = isHydrating
    ? "Loading history..."
    : "Chat with our AI assistant";

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
            <Text className="text-muted-foreground">{subtitle}</Text>
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
            {messages.length === 0 && !isHydrating ? (
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
                {isLoading && (
                  <View className="mr-auto rounded-lg border border-border bg-card p-3">
                    <ActivityIndicator color="#3b82f6" size="small" />
                  </View>
                )}
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
                disabled={!input.trim() || isLoading}
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
