/**
 * CaptureCard Component
 *
 * Display a captured item pending triage with type icon,
 * content preview, timestamp, and quick actions.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";

import {
  BiolumText,
  CaptionText,
  MonoText,
  HUDSurface,
} from "@/components/foundation";
import { useVoidTheme } from "@/hooks/use-void-theme";

export interface Capture {
  id: string;
  content: string;
  type: "voice" | "text" | "photo";
  createdAt: Date;
  status: "new" | "triaged" | "converted" | "archived";
}

export type QuickAction = "note" | "reminder" | "archive";

interface CaptureCardProps {
  capture: Capture;
  onPress: () => void;
  onQuickAction: (action: QuickAction) => void;
}

const TYPE_ICONS: Record<Capture["type"], keyof typeof Ionicons.glyphMap> = {
  voice: "mic-outline",
  text: "document-text-outline",
  photo: "camera-outline",
};

const TYPE_LABELS: Record<Capture["type"], string> = {
  voice: "Voice",
  text: "Text",
  photo: "Photo",
};

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function CaptureCardComponent({
  capture,
  onPress,
  onQuickAction,
}: CaptureCardProps) {
  const theme = useVoidTheme();
  const iconName = TYPE_ICONS[capture.type];
  const typeLabel = TYPE_LABELS[capture.type];

  const handleNotePress = useCallback(() => {
    onQuickAction("note");
  }, [onQuickAction]);

  const handleReminderPress = useCallback(() => {
    onQuickAction("reminder");
  }, [onQuickAction]);

  const handleArchivePress = useCallback(() => {
    onQuickAction("archive");
  }, [onQuickAction]);

  // Truncate content for preview
  const preview =
    capture.content.length > 100
      ? `${capture.content.slice(0, 100)}...`
      : capture.content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel} capture: ${preview}`}
      accessibilityHint="Tap to open triage options"
    >
      <HUDSurface elevation={1} style={styles.card}>
        {/* Header with type icon and timestamp */}
        <View style={styles.header}>
          <View style={styles.typeContainer}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: theme.colors.glass.surface },
              ]}
            >
              <Ionicons
                name={iconName}
                size={16}
                color={theme.colors.biolum.bright}
              />
            </View>
            <CaptionText size="small" color="dim">
              {typeLabel}
            </CaptionText>
          </View>
          <MonoText size="small" color="faint">
            {formatTimestamp(capture.createdAt)}
          </MonoText>
        </View>

        {/* Content preview */}
        <View style={styles.content}>
          <BiolumText
            variant="body"
            size="medium"
            color="standard"
            style={styles.previewText}
          >
            {preview}
          </BiolumText>
        </View>

        {/* Quick actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleNotePress}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.colors.glass.surface },
              pressed && styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Convert to note"
          >
            <Ionicons
              name="document-outline"
              size={18}
              color={theme.colors.biolum.standard}
            />
            <CaptionText
              size="small"
              color="standard"
              style={styles.actionLabel}
            >
              Note
            </CaptionText>
          </Pressable>

          <Pressable
            onPress={handleReminderPress}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.colors.glass.surface },
              pressed && styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Convert to reminder"
          >
            <Ionicons
              name="notifications-outline"
              size={18}
              color={theme.colors.biolum.standard}
            />
            <CaptionText
              size="small"
              color="standard"
              style={styles.actionLabel}
            >
              Remind
            </CaptionText>
          </Pressable>

          <Pressable
            onPress={handleArchivePress}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.colors.glass.surface },
              pressed && styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Archive capture"
          >
            <Ionicons
              name="archive-outline"
              size={18}
              color={theme.colors.biolum.faint}
            />
            <CaptionText size="small" color="faint" style={styles.actionLabel}>
              Archive
            </CaptionText>
          </Pressable>
        </View>
      </HUDSurface>
    </Pressable>
  );
}

// Memoized with custom comparison for FlashList performance
export const CaptureCard = memo(
  CaptureCardComponent,
  (prev, next) =>
    prev.capture.id === next.capture.id &&
    prev.capture === next.capture &&
    prev.onPress === next.onPress &&
    prev.onQuickAction === next.onQuickAction
);

const styles = StyleSheet.create({
  pressable: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  pressed: {
    opacity: 0.8,
  },
  card: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    marginBottom: 16,
  },
  previewText: {
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionLabel: {
    // Default styling from CaptionText
  },
});

export default CaptureCard;
