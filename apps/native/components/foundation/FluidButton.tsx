import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Pressable, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  interpolate,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText } from "./BiolumText";

type ButtonSize = "small" | "medium" | "large";
type ButtonVariant = "primary" | "secondary" | "ghost";

interface FluidButtonProps {
  onPress: () => void;
  label?: string;
  icon?: React.ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FluidButton({
  onPress,
  label,
  icon,
  size = "medium",
  variant = "primary",
  disabled = false,
  loading = false,
  haptic = true,
  style,
  children,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: FluidButtonProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const sizeConfig = getSizeConfig(size, theme);
  const variantConfig = getVariantConfig(variant, theme);

  const handlePressIn = () => {
    pressed.value = withTiming(1, { duration: 100 });
  };

  const handlePressOut = () => {
    pressed.value = withSpring(0, theme.animation.spring.default);
  };

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {
        opacity: interpolate(pressed.value, [0, 1], [1, 0.8]),
      };
    }
    return {
      transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.95]) }],
      opacity: interpolate(pressed.value, [0, 1], [1, 0.9]),
    };
  });

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: variantConfig.background,
          borderColor: variantConfig.border,
          borderWidth: 1,
          borderRadius: sizeConfig.borderRadius,
          paddingVertical: sizeConfig.paddingVertical,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          minWidth: sizeConfig.minWidth,
          minHeight: sizeConfig.minHeight,
          opacity: disabled ? 0.5 : 1,
        },
        animatedStyle,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      {children ?? (
        <>
          {icon}
          {label && (
            <BiolumText
              variant="body"
              size={size === "small" ? "small" : "medium"}
              color={variantConfig.textColor}
              style={icon ? styles.labelWithIcon : undefined}
            >
              {label}
            </BiolumText>
          )}
        </>
      )}
    </AnimatedPressable>
  );
}

function getSizeConfig(
  size: ButtonSize,
  theme: ReturnType<typeof useVoidTheme>
) {
  switch (size) {
    case "small":
      return {
        minWidth: theme.touchTargets.minimum,
        minHeight: theme.touchTargets.minimum,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radii.sm,
      };
    case "medium":
      return {
        minWidth: theme.touchTargets.comfortable,
        minHeight: theme.touchTargets.comfortable,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.md,
      };
    case "large":
      return {
        minWidth: theme.touchTargets.large,
        minHeight: theme.touchTargets.large,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.xl,
        borderRadius: theme.radii.lg,
      };
  }
}

function getVariantConfig(
  variant: ButtonVariant,
  theme: ReturnType<typeof useVoidTheme>
) {
  switch (variant) {
    case "primary":
      return {
        background: theme.colors.glass.active,
        border: "rgba(255, 255, 255, 0.20)",
        textColor: "full" as const,
      };
    case "secondary":
      return {
        background: theme.colors.glass.surface,
        border: theme.colors.glass.border,
        textColor: "bright" as const,
      };
    case "ghost":
      return {
        background: "transparent",
        border: "transparent",
        textColor: "standard" as const,
      };
  }
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  labelWithIcon: {
    marginLeft: 8,
  },
});

export default FluidButton;
