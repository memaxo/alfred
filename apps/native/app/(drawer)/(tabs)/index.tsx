import { Ionicons } from "@expo/vector-icons";
import { Redirect, Stack } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatList } from "@/components/chat/chat-list";
import { Container } from "@/components/container";
import { useChatLogic } from "@/hooks/use-chat-logic";
import { authClient } from "@/lib/auth-client";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function ChatScreen() {
  const { data: session } = authClient.useSession();
  const { isDarkColorScheme } = useColorScheme();
  const {
    messages,
    isLoading,
    error,
    currentAgent,
    setAgent,
    handleSend,
    toggleVoice,
    isRecording,
    clearMessages,
  } = useChatLogic();

  // Redirect to home if not authenticated
  if (!session?.user) {
    return <Redirect href="/(drawer)/" />;
  }

  return (
    <Container>
      <Stack.Screen
        options={{
          title:
            currentAgent === "assistant" ? "Alfred Assistant" : "Orchestrator",
          headerRight: () => (
            <View className="flex-row items-center gap-2 pr-4">
              <TouchableOpacity className="p-2" onPress={clearMessages}>
                <Ionicons
                  color={isDarkColorScheme ? "#9ca3af" : "#4b5563"}
                  name="trash-outline"
                  size={22}
                />
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-full bg-secondary px-3 py-1"
                onPress={() =>
                  setAgent(
                    currentAgent === "assistant" ? "orchestrator" : "assistant"
                  )
                }
              >
                <Text className="font-medium text-secondary-foreground text-xs">
                  {currentAgent === "assistant"
                    ? "Switch to Orchestrator"
                    : "Switch to Assistant"}
                </Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View className="flex-1 bg-background">
          {error && (
            <View className="m-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <Text className="text-center text-destructive text-sm">
                {error.message || "An error occurred. Please try again."}
              </Text>
            </View>
          )}

          <ChatList isLoading={isLoading} messages={messages} />

          <ChatInput
            disabled={isLoading}
            isRecording={isRecording}
            onSend={handleSend}
            onVoice={toggleVoice}
          />
        </View>
      </KeyboardAvoidingView>
    </Container>
  );
}
