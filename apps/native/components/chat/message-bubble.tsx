import type { UIMessage } from "@alfred/type/stream";
import {
  getAgentLabel,
  getTimestamp,
  isReasoningPart,
  isTextPart,
  isToolCallPart,
} from "@alfred/ui/chat";
import { Text, View } from "react-native";

export type MessageBubbleProps = {
  message: UIMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const agentLabel = getAgentLabel(message);
  const timestamp =
    getTimestamp(message)?.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }) ?? "";

  return (
    <View className={`mb-4 flex-col ${isUser ? "items-end" : "items-start"}`}>
      <View className="mb-1 flex-row items-baseline gap-2 px-2">
        <Text className="font-semibold text-muted-foreground text-xs">
          {agentLabel}
        </Text>
        {timestamp ? (
          <Text className="text-[10px] text-muted-foreground/60">
            {timestamp}
          </Text>
        ) : null}
      </View>
      <View
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "rounded-tr-none bg-primary"
            : "rounded-tl-none border border-border bg-card"
        }`}
      >
        {message.parts.map((part, index) => {
          if (isTextPart(part)) {
            return (
              <Text
                className={`text-[16px] leading-6 ${isUser ? "text-primary-foreground" : "text-foreground"}`}
                key={index}
              >
                {part.text}
              </Text>
            );
          }
          if (isReasoningPart(part)) {
            return (
              <View
                className="mt-2 rounded-lg border-accent border-l-2 bg-foreground/5 p-3"
                key={index}
              >
                <Text className="mb-1 font-bold text-[10px] text-accent uppercase tracking-wider">
                  Thinking
                </Text>
                <Text className="text-muted-foreground text-sm italic leading-5">
                  {part.text}
                </Text>
              </View>
            );
          }
          if (isToolCallPart(part)) {
            return (
              <View
                className="mt-2 flex-row items-center gap-2 rounded-lg bg-foreground/5 p-2"
                key={index}
              >
                <Text className="font-medium text-foreground text-sm">
                  🛠 {part.toolName}
                </Text>
              </View>
            );
          }
          return null;
        })}
      </View>
    </View>
  );
}
