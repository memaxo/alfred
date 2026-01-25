import type { UIMessage } from "@alfred/type/stream";

import {
  getAgentLabel,
  getTimestamp,
  getToolInvocationName,
  getToolInvocationState,
  isDataCachePart,
  isDataPart,
  isDataStatusPart,
  isFilePart,
  isReasoningPart,
  isTextPart,
  isToolCallPart,
  isToolInvocationPart,
  isToolResultPart,
} from "@alfred/ui/chat";
import { Text, View } from "react-native";

export interface MessageBubbleProps {
  message: UIMessage;
}

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

function isDataUiPart(
  part: unknown
): part is { type: "data-ui"; ui: unknown; data?: unknown } {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === "data-ui"
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
                  Tool: {part.toolName}
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
          if (isToolInvocationPart(part)) {
            const name = getToolInvocationName(part);
            const state = getToolInvocationState(part);
            return (
              <View
                accessibilityLabel={`Tool invocation: ${name}`}
                className="mt-2 rounded-lg border border-border/50 bg-foreground/5 p-3"
                key={index}
              >
                <Text className="mb-2 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                  Tool
                </Text>
                <Text className="font-medium text-foreground text-sm">
                  {name}
                </Text>
                <Text className="mt-1 text-muted-foreground text-xs">
                  State: {state}
                </Text>
                {"input" in part ? (
                  <Text
                    className="mt-2 text-muted-foreground text-xs leading-5"
                    selectable
                  >
                    {formatStructured((part as { input?: unknown }).input)}
                  </Text>
                ) : null}
              </View>
            );
          }
          if (isDataUiPart(part)) {
            return (
              <View
                accessibilityLabel="Generative UI"
                className="mt-2 rounded-lg border border-border/50 bg-foreground/5 p-3"
                key={index}
              >
                <Text className="mb-2 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                  UI
                </Text>
                <Text
                  className="text-muted-foreground text-xs leading-5"
                  selectable
                >
                  {formatStructured(part.ui)}
                </Text>
                {"data" in part ? (
                  <Text
                    className="mt-2 text-muted-foreground text-xs leading-5"
                    selectable
                  >
                    {formatStructured(part.data)}
                  </Text>
                ) : null}
              </View>
            );
          }
          if (isDataStatusPart(part)) {
            const raw = (part as { data?: unknown }).data;
            return (
              <View
                accessibilityLabel="Status update"
                className="mt-2 rounded-lg border border-border/50 bg-foreground/5 p-3"
                key={index}
              >
                <Text className="mb-2 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                  Status
                </Text>
                <Text
                  className="text-muted-foreground text-xs leading-5"
                  selectable
                >
                  {formatStructured(raw)}
                </Text>
              </View>
            );
          }
          if (isDataCachePart(part)) {
            const raw = (part as { data?: unknown }).data;
            return (
              <View
                accessibilityLabel="Cache event"
                className="mt-2 rounded-lg border border-border/50 bg-foreground/5 p-3"
                key={index}
              >
                <Text className="mb-2 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                  Cache
                </Text>
                <Text
                  className="text-muted-foreground text-xs leading-5"
                  selectable
                >
                  {formatStructured(raw)}
                </Text>
              </View>
            );
          }
          if (isFilePart(part)) {
            return (
              <View
                accessibilityLabel="File attachment"
                className="mt-2 rounded-lg border border-border/50 bg-foreground/5 p-3"
                key={index}
              >
                <Text className="mb-2 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                  File
                </Text>
                <Text
                  className="text-muted-foreground text-xs leading-5"
                  selectable
                >
                  {part.mediaType}
                </Text>
                <Text
                  className="mt-1 text-muted-foreground text-xs leading-5"
                  selectable
                >
                  {part.url}
                </Text>
              </View>
            );
          }
          if (isDataPart(part)) {
            return (
              <View
                accessibilityLabel="Structured data"
                className="mt-2 rounded-lg border border-border/50 bg-foreground/5 p-3"
                key={index}
              >
                <Text className="mb-2 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                  {part.type}
                </Text>
                <Text
                  className="text-muted-foreground text-xs leading-5"
                  selectable
                >
                  {formatStructured(part.data)}
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
