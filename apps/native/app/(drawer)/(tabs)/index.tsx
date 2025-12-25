import { View, KeyboardAvoidingView, Platform, Text, TouchableOpacity } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useChatLogic } from "@/hooks/use-chat-logic";
import { ChatList } from "@/components/chat/chat-list";
import { ChatInput } from "@/components/chat/chat-input";
import { Container } from "@/components/container";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function ChatScreen() {
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

  return (
    <Container>
      <Stack.Screen
        options={{
          title: currentAgent === "assistant" ? "Alfred Assistant" : "Orchestrator",
          headerRight: () => (
            <View className="flex-row items-center gap-2 pr-4">
              <TouchableOpacity 
                onPress={clearMessages}
                className="p-2"
              >
                <Ionicons 
                  name="trash-outline" 
                  size={22} 
                  color={isDarkColorScheme ? "#9ca3af" : "#4b5563"} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setAgent(currentAgent === "assistant" ? "orchestrator" : "assistant")}
                className="bg-secondary rounded-full px-3 py-1"
              >
                <Text className="text-xs font-medium text-secondary-foreground">
                  {currentAgent === "assistant" ? "Switch to Orchestrator" : "Switch to Assistant"}
                </Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        className="flex-1"
      >
        <View className="flex-1 bg-background">
          {error && (
            <View className="bg-destructive/10 p-3 m-4 rounded-lg border border-destructive/20">
              <Text className="text-destructive text-sm text-center">
                {error.message || "An error occurred. Please try again."}
              </Text>
            </View>
          )}
          
          <ChatList messages={messages} isLoading={isLoading} />
          
          <ChatInput 
            onSend={handleSend}
            onVoice={toggleVoice}
            isRecording={isRecording}
            disabled={isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </Container>
  );
}
