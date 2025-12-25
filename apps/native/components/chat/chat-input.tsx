import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
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
  placeholder = "Ask Alfred..." 
}: ChatInputProps) {
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    if (text.trim().length > 0 && !disabled) {
      onSend(text.trim());
      setText("");
    }
  }, [text, onSend, disabled]);

  return (
    <View className="p-4 border-t border-border bg-background">
      <View className="flex-row items-center gap-2">
        {onVoice && (
          <TouchableOpacity
            onPress={onVoice}
            disabled={disabled}
            className={`w-10 h-10 items-center justify-center rounded-full ${
              isRecording ? "bg-destructive" : "bg-secondary"
            }`}
          >
            {isRecording ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="mic" size={20} color={isRecording ? "white" : "gray"} />
            )}
          </TouchableOpacity>
        )}
        
        <View className="flex-1 bg-muted rounded-2xl px-4 py-2 flex-row items-center">
          <TextInput
            className="flex-1 text-foreground text-base max-h-24"
            multiline
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            disabled={disabled}
          />
        </View>

        <TouchableOpacity
          onPress={handleSend}
          disabled={disabled || text.trim().length === 0}
          className={`w-10 h-10 items-center justify-center rounded-full ${
            text.trim().length > 0 ? "bg-primary" : "bg-muted"
          }`}
        >
          <Ionicons 
            name="send" 
            size={18} 
            color={text.trim().length > 0 ? "white" : "gray"} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
