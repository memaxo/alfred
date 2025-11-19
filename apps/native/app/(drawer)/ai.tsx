import { useChat } from "@ai-sdk/react";
import { Ionicons } from "@expo/vector-icons";
import { DefaultChatTransport } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect, useRef, useState } from "react";
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

export default function AIScreen() {
  const [input, setInput] = useState("");
  const {
    messages,
    error: chatError,
    sendMessage,
  } = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: generateAPIUrl("/ai"),
    }),
    onError: (caughtError) => {
      Alert.alert("AI Chat Error", caughtError.message);
    },
  });

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const onSubmit = () => {
    const value = input.trim();
    if (value) {
      sendMessage({ text: value });
      setInput("");
    }
  };

  if (chatError) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="mb-4 text-center text-destructive text-lg">
            Error: {chatError.message}
          </Text>
          <Text className="text-center text-muted-foreground">
            Please check your connection and try again.
          </Text>
        </View>
      </Container>
    );
  }

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
              Chat with our AI assistant
            </Text>
          </View>

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
                        return (
                          <Text
                            className="text-foreground leading-relaxed"
                            key={`${message.id}-${i}`}
                          >
                            {JSON.stringify(part)}
                          </Text>
                        );
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
