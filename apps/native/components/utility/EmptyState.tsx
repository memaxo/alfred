import type { ViewStyle } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";
import { FluidButton } from "../foundation/FluidButton";

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  icon = "folder-open-outline",
  title,
  message,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const theme = useVoidTheme();

  return (
    <View
      style={[styles.container, style]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`${title}${message ? `. ${message}` : ""}`}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: theme.colors.glass.surface },
        ]}
        accessibilityElementsHidden={true}
      >
        <Ionicons name={icon} size={48} color={theme.colors.biolum.faint} />
      </View>
      <BiolumText
        variant="title"
        size="medium"
        color="standard"
        style={styles.title}
      >
        {title}
      </BiolumText>
      {message && (
        <CaptionText size="large" color="dim" style={styles.message}>
          {message}
        </CaptionText>
      )}
      {actionLabel && onAction && (
        <FluidButton
          label={actionLabel}
          variant="secondary"
          size="medium"
          onPress={onAction}
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    textAlign: "center",
    maxWidth: 280,
  },
  action: {
    marginTop: 24,
  },
});

export default EmptyState;
