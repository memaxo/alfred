import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState, useCallback } from "react";
import { StyleSheet, View, TextInput, Keyboard } from "react-native";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { FluidButton } from "../foundation/FluidButton";
import { HUDSurface } from "../foundation/HUDSurface";

export interface ChatInputVoidProps {
  onSend: (text: string) => void;
  onVoice?: () => void;
  disabled?: boolean;
  isRecording?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function ChatInputVoid({
  onSend,
  onVoice,
  disabled = false,
  isRecording = false,
  placeholder = "Message Alfred...",
  maxLength = 4000,
}: ChatInputVoidProps) {
  const theme = useVoidTheme();
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed);
    setText("");
    Keyboard.dismiss();
  }, [text, disabled, onSend]);

  const handleVoice = useCallback(() => {
    if (!onVoice) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVoice();
  }, [onVoice]);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <HUDSurface elevation={2} style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              color: theme.colors.biolum.standard,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.biolum.faint}
          multiline
          maxLength={maxLength}
          editable={!disabled}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          accessibilityLabel="Message input"
          accessibilityHint="Type your message to Alfred"
          testID="chat-input"
        />

        <View style={styles.actions} accessibilityRole="toolbar">
          {onVoice && (
            <FluidButton
              icon={
                <Ionicons
                  name={isRecording ? "stop-circle" : "mic"}
                  size={20}
                  color={
                    isRecording
                      ? theme.colors.semantic.error
                      : theme.colors.biolum.dim
                  }
                />
              }
              variant="ghost"
              size="small"
              onPress={handleVoice}
              disabled={disabled}
              accessibilityLabel={
                isRecording ? "Stop recording" : "Start voice recording"
              }
              accessibilityHint={
                isRecording
                  ? "Tap to stop recording your message"
                  : "Tap to record a voice message"
              }
            />
          )}

          <FluidButton
            icon={
              <Ionicons
                name="send"
                size={18}
                color={
                  canSend ? theme.colors.biolum.full : theme.colors.biolum.faint
                }
              />
            }
            variant={canSend ? "primary" : "ghost"}
            size="small"
            onPress={handleSend}
            disabled={!canSend}
            accessibilityLabel="Send message"
            accessibilityHint={
              canSend ? "Tap to send your message" : "Type a message first"
            }
            testID="send-button"
          />
        </View>
      </View>

      {text.length > maxLength * 0.8 && (
        <View style={styles.charCount}>
          <Ionicons
            name="text"
            size={12}
            color={
              text.length >= maxLength
                ? theme.colors.semantic.error
                : theme.colors.biolum.faint
            }
          />
          <View style={{ marginLeft: 4 }}>
            <Ionicons
              name="ellipse"
              size={8}
              color={
                text.length >= maxLength
                  ? theme.colors.semantic.error
                  : theme.colors.biolum.faint
              }
            />
          </View>
        </View>
      )}
    </HUDSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingBottom: 4,
  },
  charCount: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
});

export default ChatInputVoid;
