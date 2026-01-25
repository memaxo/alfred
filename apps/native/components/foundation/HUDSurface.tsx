import type { ViewStyle, StyleProp } from "react-native";

import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { useVoidTheme } from "../../hooks/use-void-theme";

interface HUDSurfaceProps {
  elevation?: 1 | 2 | 3;
  glow?: boolean;
  active?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function HUDSurface({
  elevation = 1,
  glow = false,
  active = false,
  children,
  style,
}: HUDSurfaceProps) {
  const theme = useVoidTheme();

  const config = getElevationConfig(elevation, theme);
  const glowStyle = glow ? theme.glow.medium : {};

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: withTiming(
        active ? "rgba(255, 255, 255, 0.20)" : config.borderColor,
        {
          duration: theme.animation.duration.fast,
        }
      ),
    };
  }, [active]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.background,
          borderRadius: config.borderRadius,
          borderWidth: 1,
        },
        animatedStyle,
        glowStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function getElevationConfig(
  level: 1 | 2 | 3,
  theme: ReturnType<typeof useVoidTheme>
) {
  switch (level) {
    case 1: {
      return {
        background: theme.colors.glass.surface,
        borderColor: theme.colors.glass.border,
        borderRadius: theme.radii.lg,
      };
    }
    case 2: {
      return {
        background: theme.colors.glass.hover,
        borderColor: theme.colors.glass.border,
        borderRadius: theme.radii.xl,
      };
    }
    case 3: {
      return {
        background: theme.colors.glass.active,
        borderColor: "rgba(255, 255, 255, 0.10)",
        borderRadius: theme.radii.xxl,
      };
    }
  }
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

export default HUDSurface;
