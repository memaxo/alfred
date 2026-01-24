import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  SharedValue,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";

export interface ProgressProps {
  value: number; // 0-100
  variant?: "radial" | "linear";
  size?: number;
  showLabel?: boolean;
  label?: string;
  animate?: boolean;
  glowOnComplete?: boolean;
  style?: ViewStyle;
}

export function Progress({
  value,
  variant = "radial",
  size = 64,
  showLabel = true,
  label,
  animate = true,
  glowOnComplete = true,
  style,
}: ProgressProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const animatedProgress = useSharedValue(animate && !reduceMotion ? 0 : value);
  const glowOpacity = useSharedValue(0);

  const clampedValue = Math.max(0, Math.min(100, value));

  useEffect(() => {
    if (animate && !reduceMotion) {
      animatedProgress.value = withTiming(clampedValue, { duration: 1000 });
    } else {
      animatedProgress.value = clampedValue;
    }

    if (glowOnComplete && clampedValue >= 100 && !reduceMotion) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.15, { duration: 1500 }),
          withTiming(0.05, { duration: 1500 })
        ),
        -1,
        false
      );
    } else {
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [clampedValue, animate, glowOnComplete, reduceMotion]);

  if (variant === "linear") {
    return (
      <LinearProgress
        value={clampedValue}
        animatedProgress={animatedProgress}
        showLabel={showLabel}
        label={label}
        theme={theme}
        style={style}
      />
    );
  }

  return (
    <RadialProgress
      value={clampedValue}
      animatedProgress={animatedProgress}
      glowOpacity={glowOpacity}
      size={size}
      showLabel={showLabel}
      label={label}
      theme={theme}
      style={style}
    />
  );
}

interface RadialProgressProps {
  value: number;
  animatedProgress: SharedValue<number>;
  glowOpacity: SharedValue<number>;
  size: number;
  showLabel: boolean;
  label?: string;
  theme: ReturnType<typeof useVoidTheme>;
  style?: ViewStyle;
}

function RadialProgress({
  value,
  animatedProgress,
  glowOpacity,
  size,
  showLabel,
  label,
  theme,
  style,
}: RadialProgressProps) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  const progressOffset = circumference - (value / 100) * circumference;

  return (
    <Animated.View
      style={[
        styles.radialContainer,
        {
          width: size,
          height: size,
          shadowColor: "#ffffff",
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 20,
          elevation: 2,
        },
        animatedStyle,
        style,
      ]}
    >
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.10)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.biolum.bright}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showLabel && (
        <View style={styles.radialLabel}>
          <BiolumText variant="body" size="medium" color="full">
            {Math.round(value)}%
          </BiolumText>
        </View>
      )}
      {label && (
        <CaptionText size="small" color="dim" style={styles.labelText}>
          {label}
        </CaptionText>
      )}
    </Animated.View>
  );
}

interface LinearProgressProps {
  value: number;
  animatedProgress: SharedValue<number>;
  showLabel: boolean;
  label?: string;
  theme: ReturnType<typeof useVoidTheme>;
  style?: ViewStyle;
}

function LinearProgress({
  value,
  animatedProgress,
  showLabel,
  label,
  theme,
  style,
}: LinearProgressProps) {
  const animatedWidth = useAnimatedStyle(() => ({
    width: `${animatedProgress.value}%`,
  }));

  return (
    <View style={[styles.linearContainer, style]}>
      {(label || showLabel) && (
        <View style={styles.linearHeader}>
          {label && (
            <CaptionText size="medium" color="dim">
              {label}
            </CaptionText>
          )}
          {showLabel && (
            <CaptionText size="medium" color="standard">
              {Math.round(value)}%
            </CaptionText>
          )}
        </View>
      )}
      <View
        style={[
          styles.linearTrack,
          { backgroundColor: "rgba(255, 255, 255, 0.10)" },
        ]}
      >
        <Animated.View
          style={[
            styles.linearProgress,
            {
              backgroundColor: theme.colors.biolum.bright,
            },
            animatedWidth,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  radialContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  radialLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  labelText: {
    position: "absolute",
    bottom: -20,
  },
  linearContainer: {
    width: "100%",
  },
  linearHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  linearTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  linearProgress: {
    height: "100%",
    borderRadius: 2,
  },
});

export default Progress;
