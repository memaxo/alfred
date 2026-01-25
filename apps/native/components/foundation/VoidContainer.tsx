import type { ViewStyle } from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { NoiseOverlay } from "./NoiseOverlay";

interface VoidContainerProps {
  gradient?: "ambient" | "flat" | "header" | "control";
  noise?: boolean;
  noiseOpacity?: number;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function VoidContainer({
  gradient = "ambient",
  noise = true,
  noiseOpacity = 0.02,
  children,
  style,
}: VoidContainerProps) {
  const theme = useVoidTheme();

  if (gradient === "flat") {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.void.deep },
          style,
        ]}
      >
        {noise && <NoiseOverlay opacity={noiseOpacity} />}
        {children}
      </View>
    );
  }

  const gradientConfig = getGradientConfig(gradient, theme.colors);

  return (
    <LinearGradient
      colors={gradientConfig.colors}
      locations={gradientConfig.locations}
      start={gradientConfig.start}
      end={gradientConfig.end}
      style={[styles.container, style]}
    >
      {noise && <NoiseOverlay opacity={noiseOpacity} />}
      {children}
    </LinearGradient>
  );
}

function getGradientConfig(
  type: "ambient" | "header" | "control",
  colors: ReturnType<typeof useVoidTheme>["colors"]
) {
  switch (type) {
    case "ambient": {
      return {
        colors: [
          colors.void.surface,
          colors.void.deep,
          colors.void.absolute,
        ] as const,
        locations: [0, 0.5, 1] as const,
        start: { x: 0.5, y: 0.4 },
        end: { x: 0.5, y: 1 },
      };
    }
    case "header": {
      return {
        colors: [colors.void.surface, "transparent"] as const,
        locations: [0, 1] as const,
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 },
      };
    }
    case "control": {
      return {
        colors: ["transparent", colors.void.surface] as const,
        locations: [0, 1] as const,
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 },
      };
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default VoidContainer;
