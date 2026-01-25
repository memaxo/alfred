import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withRepeat,
  withSequence,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, MonoText } from "../foundation/BiolumText";

type ToolState = "pending" | "running" | "success" | "error";

interface ToolCallCardProps {
  toolName: string;
  input?: unknown;
  output?: unknown;
  state?: ToolState;
  isError?: boolean;
}

export function ToolCallCard({
  toolName,
  input,
  output,
  state = "pending",
  isError = false,
}: ToolCallCardProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const pulseOpacity = useSharedValue(1);

  const effectiveState = isError ? "error" : state;
  const stateConfig = getStateConfig(effectiveState, theme);

  useEffect(() => {
    if (effectiveState === "running" && !reduceMotion) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        false
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [effectiveState, reduceMotion]);

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    borderLeftColor: stateConfig.borderColor,
    opacity: effectiveState === "running" ? pulseOpacity.value : 1,
  }));

  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.glass.surface,
        },
        borderAnimatedStyle,
      ]}
      accessibilityLabel={`Tool: ${toolName}, Status: ${effectiveState}`}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <StateIcon state={effectiveState} theme={theme} />
          <BiolumText variant="title" size="small" color="standard">
            {toolName}
          </BiolumText>
        </View>
        <View
          style={[
            styles.stateBadge,
            { backgroundColor: stateConfig.badgeBackground },
          ]}
        >
          <BiolumText
            variant="caption"
            size="small"
            color={stateConfig.badgeTextColor}
          >
            {effectiveState}
          </BiolumText>
        </View>
      </View>

      {input !== undefined && (
        <View style={styles.section}>
          <BiolumText variant="caption" size="small" color="faint">
            Input
          </BiolumText>
          <MonoText size="small" color="dim" numberOfLines={5}>
            {formatValue(input)}
          </MonoText>
        </View>
      )}

      {output !== undefined && (
        <View style={styles.section}>
          <BiolumText variant="caption" size="small" color="faint">
            Output
          </BiolumText>
          <MonoText
            size="small"
            color={isError ? "faint" : "dim"}
            numberOfLines={10}
            selectable
          >
            {formatValue(output)}
          </MonoText>
        </View>
      )}
    </Animated.View>
  );
}

function StateIcon({
  state,
  theme,
}: {
  state: ToolState;
  theme: ReturnType<typeof useVoidTheme>;
}) {
  switch (state) {
    case "pending": {
      return (
        <Ionicons
          name="time-outline"
          size={16}
          color={theme.colors.biolum.faint}
        />
      );
    }
    case "running": {
      return (
        <Ionicons name="sync" size={16} color={theme.colors.biolum.standard} />
      );
    }
    case "success": {
      return (
        <Ionicons
          name="checkmark-circle"
          size={16}
          color={theme.colors.semantic.success}
        />
      );
    }
    case "error": {
      return (
        <Ionicons
          name="alert-circle"
          size={16}
          color={theme.colors.semantic.error}
        />
      );
    }
  }
}

function getStateConfig(
  state: ToolState,
  theme: ReturnType<typeof useVoidTheme>
) {
  switch (state) {
    case "pending": {
      return {
        borderColor: theme.colors.biolum.faint,
        badgeBackground: theme.colors.glass.surface,
        badgeTextColor: "faint" as const,
      };
    }
    case "running": {
      return {
        borderColor: theme.colors.biolum.standard,
        badgeBackground: theme.colors.glass.hover,
        badgeTextColor: "standard" as const,
      };
    }
    case "success": {
      return {
        borderColor: theme.colors.semantic.success,
        badgeBackground: "rgba(145, 200, 145, 0.15)",
        badgeTextColor: "bright" as const,
      };
    }
    case "error": {
      return {
        borderColor: theme.colors.semantic.error,
        badgeBackground: "rgba(200, 145, 145, 0.15)",
        badgeTextColor: "faint" as const,
      };
    }
  }
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    borderLeftWidth: 2,
    borderRadius: 8,
    padding: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  section: {
    marginTop: 8,
    gap: 4,
  },
});

export default ToolCallCard;
