import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatList } from "@/components/chat/chat-list";
import { useChatLogic } from "@/hooks/use-chat-logic";
import { useColorScheme } from "@/lib/use-color-scheme";

import type { WindowComponentProps } from "./types";

export function ChatWindow(_props: WindowComponentProps) {
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
    isHydrating,
  } = useChatLogic();

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-border border-b px-3 py-2">
        <View className="flex-row items-center gap-2">
          <Text className="font-semibold text-foreground text-sm">
            {currentAgent === "assistant" ? "Assistant" : "Orchestrator"}
          </Text>
          {isRecording ? (
            <Text className="text-muted-foreground text-xs">Listening…</Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable className="p-2" onPress={clearMessages}>
            <Ionicons
              color={isDarkColorScheme ? "#9ca3af" : "#4b5563"}
              name="trash-outline"
              size={18}
            />
          </Pressable>
          <Pressable
            className="rounded-full bg-secondary px-3 py-1"
            onPress={() =>
              setAgent(
                currentAgent === "assistant" ? "orchestrator" : "assistant"
              )
            }
          >
            <Text className="font-medium text-[11px] text-secondary-foreground">
              Switch
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-1 bg-background">
        {isHydrating ? (
          <View className="absolute inset-0 z-10 items-center justify-center bg-background/80">
            <Text className="text-muted-foreground text-sm">Loading…</Text>
          </View>
        ) : null}

        {error ? (
          <View className="m-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
            <Text className="text-center text-destructive text-sm">
              {error.message || "An error occurred. Please try again."}
            </Text>
          </View>
        ) : null}

        <ChatList isLoading={isLoading} messages={messages} />

        <ChatInput
          disabled={isLoading}
          isRecording={isRecording}
          onSend={handleSend}
          onVoice={toggleVoice}
        />
      </View>
    </View>
  );
}
