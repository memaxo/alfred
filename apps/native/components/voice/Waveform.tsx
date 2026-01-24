import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";

export interface WaveformProps {
  audioLevel?: number; // 0-1
  barCount?: number;
  width?: number;
  height?: number;
  active?: boolean;
  style?: ViewStyle;
}

export function Waveform({
  audioLevel = 0,
  barCount = 32,
  width,
  height = 40,
  active = true,
  style,
}: WaveformProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();

  return (
    <View style={[styles.container, { height }, style]}>
      {Array.from({ length: barCount }).map((_, index) => (
        <WaveformBar
          key={index}
          index={index}
          audioLevel={audioLevel}
          maxHeight={height}
          active={active}
          theme={theme}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

interface WaveformBarProps {
  index: number;
  audioLevel: number;
  maxHeight: number;
  active: boolean;
  theme: ReturnType<typeof useVoidTheme>;
  reduceMotion: boolean;
}

function WaveformBar({
  index,
  audioLevel,
  maxHeight,
  active,
  theme,
  reduceMotion,
}: WaveformBarProps) {
  const animatedHeight = useSharedValue(4);
  const baseHeight = 4;

  useEffect(() => {
    if (!active || reduceMotion) {
      animatedHeight.value = withTiming(baseHeight, { duration: 200 });
      return;
    }

    // Create variation based on index for natural wave effect
    const variation = Math.sin(index * 0.5) * 0.3 + 0.7;
    const targetHeight = Math.max(
      baseHeight,
      maxHeight * audioLevel * variation
    );

    animatedHeight.value = withTiming(targetHeight, { duration: 100 });
  }, [audioLevel, active, reduceMotion, index, maxHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.biolum.standard,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 4,
  },
});

export default Waveform;
