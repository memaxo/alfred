import { Ionicons } from "@expo/vector-icons";
import { Redirect, Stack } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  View,
  StyleSheet,
} from "react-native";

import { AgentSwitcher } from "@/components/chat/AgentSwitcher";
import { ChatList } from "@/components/chat/chat-list";
import { ChatInputVoid } from "@/components/chat/ChatInputVoid";
import { BiolumText, CaptionText } from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { useChatLogic } from "@/hooks/use-chat-logic";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { useServerUrl } from "@/lib/api";
import { useAuthClient } from "@/lib/auth-client";
import { isLocalServer } from "@/lib/server-url";

type AgentMode =
  | "assistant"
  | "orchestrator"
  | "researcher"
  | "executor"
  | "coder"
  | "chat";

export default function ChatScreen() {
  const authClient = useAuthClient();
  const { data: session } = authClient.useSession();
  const { serverUrl } = useServerUrl();
  const theme = useVoidTheme();
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

  // Redirect to home if not authenticated
  if (!(session?.user || isLocalServer(serverUrl))) {
    return <Redirect href="/(drawer)/" />;
  }

  const handleAgentChange = (agent: AgentMode) => {
    if (agent === "assistant" || agent === "orchestrator") {
      setAgent(agent);
    }
  };

  return (
    <VoidContainer gradient="ambient" noise={true}>
      <Stack.Screen
        options={{
          title:
            currentAgent === "assistant" ? "Alfred Assistant" : "Orchestrator",
          headerStyle: {
            backgroundColor: theme.colors.void.deep,
          },
          headerTintColor: theme.colors.biolum.full,
          headerTitleStyle: {
            color: theme.colors.biolum.full,
          },
          headerRight: () => (
            <View style={styles.headerRight}>
              <FluidButton
                icon={
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={theme.colors.biolum.dim}
                  />
                }
                variant="ghost"
                size="small"
                onPress={clearMessages}
              />
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.flex}>
          {/* Agent Mode Selector */}
          <AgentSwitcher
            currentAgent={currentAgent as AgentMode}
            onSelectAgent={handleAgentChange}
            disabled={isLoading}
          />

          {/* Loading overlay */}
          {isHydrating && (
            <View
              style={[
                styles.loadingOverlay,
                { backgroundColor: "rgba(10, 10, 10, 0.9)" },
              ]}
            >
              <ActivityIndicator
                color={theme.colors.biolum.standard}
                size="large"
              />
              <CaptionText size="medium" color="dim" style={styles.loadingText}>
                Loading history...
              </CaptionText>
            </View>
          )}

          {/* Error display */}
          {error && (
            <HUDSurface elevation={1} style={styles.errorContainer}>
              <View
                style={[
                  styles.errorStripe,
                  { backgroundColor: theme.colors.semantic.error },
                ]}
              />
              <View style={styles.errorContent}>
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color={theme.colors.semantic.error}
                />
                <BiolumText
                  variant="body"
                  size="small"
                  color="standard"
                  style={styles.errorText}
                >
                  {error.message || "An error occurred. Please try again."}
                </BiolumText>
              </View>
            </HUDSurface>
          )}

          {/* Chat messages */}
          <ChatList
            isLoading={isLoading}
            messages={messages}
            streamingMessageId={isLoading ? messages.at(-1)?.id : null}
          />

          {/* Input area */}
          <ChatInputVoid
            disabled={isLoading}
            isRecording={isRecording}
            onSend={handleSend}
            onVoice={toggleVoice}
          />
        </View>
      </KeyboardAvoidingView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
  },
  errorContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: "hidden",
  },
  errorStripe: {
    height: 3,
  },
  errorContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
  },
});
