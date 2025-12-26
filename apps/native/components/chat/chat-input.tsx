import { Ionicons } from "@expo/vector-icons";
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
  disabled?: boolean;
  isRecording?: boolean;
  placeholder?: string;
};

export function ChatInput({
  onSend,
  onVoice,
  disabled,
  isRecording,
  placeholder = "Ask Alfred...",
}: ChatInputProps) {
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    if (text.trim().length > 0 && !disabled) {
      onSend(text.trim());
      setText("");
    }
  }, [text, onSend, disabled]);

  return (
    <View className="border-border border-t bg-background p-4">
      <View className="flex-row items-center gap-2">
        {onVoice && (
          <TouchableOpacity
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
