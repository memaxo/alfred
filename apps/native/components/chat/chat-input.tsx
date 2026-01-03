import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export type ChatInputProps = {
  onSend: (text: string) => void;
  onVoice?: () => void;
  onCall?: () => void;
  disabled?: boolean;
  isRecording?: boolean;
  placeholder?: string;
  showCallButton?: boolean;
};

export function ChatInput({
  onSend,
  onVoice,
  onCall,
  disabled,
  isRecording,
  placeholder = "Ask Alfred...",
  showCallButton = true,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const router = useRouter();

  const handleSend = useCallback(() => {
    if (text.trim().length > 0 && !disabled) {
      onSend(text.trim());
      setText("");
    }
  }, [text, onSend, disabled]);

  const handleCall = useCallback(() => {
    if (onCall) {
      onCall();
    } else {
      router.push("./call");
    }
  }, [onCall, router]);

  return (
    <View className="border-border border-t bg-background p-4">
      <View className="flex-row items-center gap-2">
        {/* Call Alfred button - opens voice call screen */}
        {showCallButton && (
          <TouchableOpacity
            accessibilityHint="Starts a real-time voice conversation with the AI assistant"
            accessibilityLabel="Call Alfred"
            accessibilityRole="button"
            className="h-10 w-10 items-center justify-center rounded-full bg-primary"
            disabled={disabled}
            onPress={handleCall}
          >
            <Ionicons color="white" name="call" size={20} />
          </TouchableOpacity>
        )}

        {/* Voice input button (for inline recording) */}
        {onVoice && (
          <TouchableOpacity
            accessibilityHint="Speak to input text into the chat"
            accessibilityLabel={
              isRecording ? "Stop recording" : "Record voice message"
            }
            accessibilityRole="button"
            className={`h-10 w-10 items-center justify-center rounded-full ${
              isRecording ? "bg-destructive" : "bg-secondary"
            }`}
            disabled={disabled}
            onPress={onVoice}
          >
            {isRecording ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons
                color={isRecording ? "white" : "gray"}
                name="mic"
                size={20}
              />
            )}
          </TouchableOpacity>
        )}

        <View className="flex-1 flex-row items-center rounded-2xl bg-muted px-4 py-2">
          <TextInput
            accessibilityHint="Type your message here"
            accessibilityLabel="Chat input field"
            accessibilityRole="search"
            className="max-h-24 flex-1 text-base text-foreground"
            editable={!disabled}
            multiline
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            value={text}
          />
        </View>

        <TouchableOpacity
          accessibilityLabel="Send message"
          accessibilityRole="button"
          accessibilityState={{
            disabled: disabled || text.trim().length === 0,
          }}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            text.trim().length > 0 ? "bg-primary" : "bg-muted"
          }`}
          disabled={disabled || text.trim().length === 0}
          onPress={handleSend}
        >
          <Ionicons
            color={text.trim().length > 0 ? "white" : "gray"}
            name="send"
            size={18}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
