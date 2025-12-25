import type { UIMessage } from "@alfred/type/stream";
import { View, Text } from "react-native";
import { 
  getAgentLabel, 
  getTimestamp, 
  isTextPart, 
  isReasoningPart, 
  isToolCallPart 
} from "@alfred/ui/src/chat/parts";

export type MessageBubbleProps = {
  message: UIMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const agentLabel = getAgentLabel(message);
  const timestamp = getTimestamp(message)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? "";

  return (
    <View className={`mb-4 flex-col ${isUser ? "items-end" : "items-start"}`}>
      <View className="flex-row items-baseline gap-2 mb-1 px-2">
        <Text className="text-xs font-semibold text-muted-foreground">{agentLabel}</Text>
        {timestamp ? <Text className="text-[10px] text-muted-foreground/60">{timestamp}</Text> : null}
      </View>
      <View
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser ? "bg-primary rounded-tr-none" : "bg-card rounded-tl-none border border-border"
        }`}
      >
        {message.parts.map((part, index) => {
          if (isTextPart(part)) {
            return (
              <Text
                key={index}
                className={`text-[16px] leading-6 ${isUser ? "text-primary-foreground" : "text-foreground"}`}
              >
                {part.text}
              </Text>
            );
          }
          if (isReasoningPart(part)) {
            return (
              <View key={index} className="mt-2 bg-foreground/5 rounded-lg p-3 border-l-2 border-accent">
                <Text className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">Thinking</Text>
                <Text className="text-sm text-muted-foreground italic leading-5">{part.text}</Text>
              </View>
            );
          }
          if (isToolCallPart(part)) {
             return (
              <View key={index} className="mt-2 flex-row items-center gap-2 bg-foreground/5 rounded-lg p-2">
                <Text className="text-sm font-medium text-foreground">🛠 {part.toolName}</Text>
              </View>
            );
          }
          return null;
        })}
      </View>
    </View>
  );
}
