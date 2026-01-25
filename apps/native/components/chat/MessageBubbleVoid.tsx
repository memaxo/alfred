import type { UIMessage } from "@alfred/type/stream";

import {
  getAgentLabel,
  getTimestamp,
  isDataCachePart,
  isDataPart,
  isDataStatusPart,
  isFilePart,
  isReasoningPart,
  isTextPart,
  isToolCallPart,
  isToolResultPart,
} from "@alfred/ui/chat";
import React from "react";
import { StyleSheet, View } from "react-native";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText, MonoText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";
import { GenUIRenderer } from "../genui/renderer";
import { CacheHandoffBadge } from "./CacheHandoffBadge";
import { ReasoningCard } from "./ReasoningCard";
import { StreamingText } from "./StreamingText";
import { ToolCallCard } from "./ToolCallCard";

export interface MessageBubbleVoidProps {
  message: UIMessage;
  isStreaming?: boolean;
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

function isToolError(part: unknown): boolean {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { isError?: unknown }).isError === true
  );
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
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function MessageBubbleVoid({
  message,
  isStreaming = false,
}: MessageBubbleVoidProps) {
  const theme = useVoidTheme();
  const isUser = message.role === "user";
  const agentLabel = getAgentLabel(message);
  const timestamp =
    getTimestamp(message)?.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }) ?? "";

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
      accessibilityLabel={`Message from ${agentLabel} at ${timestamp}`}
      accessibilityRole="text"
    >
      <View style={styles.header}>
        <CaptionText size="medium" color="dim">
          {agentLabel}
        </CaptionText>
        {timestamp && (
          <CaptionText size="small" color="faint">
            {timestamp}
          </CaptionText>
        )}
      </View>

      {isUser ? (
        <HUDSurface elevation={2} style={styles.userBubble}>
          {renderParts(message, theme, isStreaming)}
        </HUDSurface>
      ) : (
        <View style={styles.assistantBubble}>
          {renderParts(message, theme, isStreaming)}
        </View>
      )}
    </View>
  );
}

function renderParts(
  message: UIMessage,
  theme: ReturnType<typeof useVoidTheme>,
  isStreaming: boolean
) {
  return message.parts.map((part, index) => {
    if (isTextPart(part)) {
      const isLastPart = index === message.parts.length - 1;
      if (isStreaming && isLastPart) {
        return (
          <StreamingText key={index} text={part.text} isStreaming={true} />
        );
      }
      return (
        <BiolumText
          key={index}
          variant="body"
          size="large"
          color={message.role === "user" ? "full" : "standard"}
          selectable
        >
          {part.text}
        </BiolumText>
      );
    }

    if (isReasoningPart(part)) {
      return (
        <ReasoningCard
          key={index}
          text={part.text}
          state={isStreaming ? "thinking" : "complete"}
        />
      );
    }

    if (isToolCallPart(part)) {
      return (
        <ToolCallCard
          key={index}
          toolName={part.toolName}
          input={part.input}
          state="running"
        />
      );
    }

    if (isToolResultPart(part)) {
      return (
        <ToolCallCard
          key={index}
          toolName={part.toolName}
          output={part.output}
          state="success"
          isError={isToolError(part)}
        />
      );
    }

    if (isDataUiPart(part)) {
      const dataUiPart = part as {
        type: "data-ui";
        ui: unknown;
        data?: unknown;
      };
      const ui = dataUiPart.ui as
        | {
            component: string;
            props?: Record<string, unknown>;
            children?: {
              component: string;
              props?: Record<string, unknown>;
            }[];
          }
        | undefined;
      if (!ui || typeof ui !== "object" || !("component" in ui)) {
        return null;
      }
      return (
        <View key={index} style={styles.genuiContainer}>
          <GenUIRenderer
            part={{ type: "data-ui", ui, data: dataUiPart.data }}
            fallbackToJson={true}
          />
        </View>
      );
    }

    if (isDataCachePart(part)) {
      return <CacheHandoffBadge key={index} visible={true} />;
    }

    if (isDataStatusPart(part)) {
      const raw = (part as { data?: unknown }).data;
      return (
        <View
          key={index}
          style={[
            styles.statusCard,
            {
              backgroundColor: theme.colors.glass.surface,
              borderColor: theme.colors.glass.border,
            },
          ]}
        >
          <CaptionText size="small" color="faint">
            Status
          </CaptionText>
          <MonoText size="small" color="dim">
            {formatStructured(raw)}
          </MonoText>
        </View>
      );
    }

    if (isFilePart(part)) {
      return (
        <View
          key={index}
          style={[
            styles.fileCard,
            {
              backgroundColor: theme.colors.glass.surface,
              borderColor: theme.colors.glass.border,
            },
          ]}
        >
          <CaptionText size="small" color="faint">
            File
          </CaptionText>
          <BiolumText variant="body" size="small" color="dim">
            {part.mediaType}
          </BiolumText>
          <MonoText size="small" color="faint" numberOfLines={1}>
            {part.url}
          </MonoText>
        </View>
      );
    }

    if (isDataPart(part)) {
      return (
        <View
          key={index}
          style={[
            styles.dataCard,
            {
              backgroundColor: theme.colors.glass.surface,
              borderColor: theme.colors.glass.border,
            },
          ]}
        >
          <CaptionText size="small" color="faint">
            {part.type}
          </CaptionText>
          <MonoText size="small" color="dim" numberOfLines={5}>
            {formatStructured(part.data)}
          </MonoText>
        </View>
      );
    }

    return null;
  });
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  userContainer: {
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  userBubble: {
    maxWidth: "85%",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 8,
  },
  assistantBubble: {
    maxWidth: "100%",
    paddingVertical: 8,
  },
  dataCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  statusCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  fileCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  genuiContainer: {
    marginTop: 8,
    width: "100%",
  },
});

export default MessageBubbleVoid;
