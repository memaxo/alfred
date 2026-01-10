import type { UIMessage } from "@alfred/type/stream";
import {
  getAgentLabel,
  getTimestamp,
  isReasoningPart,
  isTextPart,
  isToolCallPart,
  isToolResultPart,
} from "@alfred/ui/chat";
import { Text, View } from "react-native";

export type MessageBubbleProps = {
  message: UIMessage;
};

function formatStructured(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  try {
    const json = JSON.stringify(value, null, 2);
    return json ?? String(value);
  } catch {
    return String(value);
  }
}

function isToolError(part: unknown): boolean {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { isError?: unknown }).isError === true
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const agentLabel = getAgentLabel(message);
  const timestamp =
    getTimestamp(message)?.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }) ?? "";

  return (
    <View
      accessibilityLabel={`Message from ${agentLabel} at ${timestamp}`}
      accessibilityRole="text"
      className={`mb-4 flex-col ${isUser ? "items-end" : "items-start"}`}
    >
      <View className="mb-1 flex-row items-baseline gap-2 px-2">
        <Text className="font-semibold text-muted-foreground text-xs">
          {agentLabel}
        </Text>
        {timestamp ? (
          <Text
            accessibilityLabel={`Sent at ${timestamp}`}
            className="text-[10px] text-muted-foreground/60"
          >
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
                selectable
              >
                {part.text}
              </Text>
            );
          }
          if (isReasoningPart(part)) {
            return (
              <View
                accessibilityLabel="Assistant reasoning"
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
                accessibilityLabel={`Using tool: ${part.toolName}`}
                className="mt-2 rounded-lg border border-border/50 bg-foreground/5 p-3"
                key={index}
              >
                <Text className="mb-2 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                  Tool Call
                </Text>
                <Text className="font-medium text-foreground text-sm">
                  🛠 {part.toolName}
                </Text>
                <Text
                  className="mt-2 text-muted-foreground text-xs leading-5"
                  selectable
                >
                  {formatStructured(part.input)}
                </Text>
              </View>
            );
          }
          if (isToolResultPart(part)) {
            const errored = isToolError(part);
            return (
              <View
                accessibilityLabel={`Tool result: ${part.toolName}`}
                className={`mt-2 rounded-lg border p-3 ${
                  errored
                    ? "border-destructive/30 bg-destructive/10"
                    : "border-border/50 bg-foreground/5"
                }`}
                key={index}
              >
                <Text
                  className={`mb-2 font-bold text-[10px] uppercase tracking-wider ${
                    errored ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {errored ? "Tool Error" : "Tool Result"}
                </Text>
                <Text className="font-medium text-foreground text-sm">
                  {part.toolName}
                </Text>
                <Text
                  className="mt-2 text-muted-foreground text-xs leading-5"
                  selectable
                >
                  {formatStructured(part.output)}
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
