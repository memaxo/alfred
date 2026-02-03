import React from "react";
import { type ViewStyle, View, StyleSheet } from "react-native";

import { BiolumOrb } from "./BiolumOrb";
import { TitleText, BodyText } from "./BiolumText";
import { FluidButton } from "./FluidButton";

type EmptyStateSize = "small" | "medium" | "large";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  size?: EmptyStateSize;
  style?: ViewStyle;
}

const ORB_SIZES: Record<EmptyStateSize, number> = {
  small: 80,
  medium: 120,
  large: 160,
};

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  size = "medium",
  style,
}: EmptyStateProps) {
  const orbSize = ORB_SIZES[size];

  return (
    <View style={[styles.container, style]}>
      <View style={styles.orbContainer}>
        <BiolumOrb size={orbSize} pulsing active={false} />
        {icon && <View style={styles.iconOverlay}>{icon}</View>}
      </View>
      <TitleText style={styles.title}>{title}</TitleText>
      <BodyText color="dim" style={styles.description}>
        {description}
      </BodyText>
      {actionLabel && onAction && (
        <FluidButton
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          size="medium"
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  orbContainer: {
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOverlay: {
    position: "absolute",
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    textAlign: "center",
    maxWidth: 280,
  },
  action: {
    marginTop: 24,
  },
});

export default EmptyState;
