import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";

export interface VADIndicatorProps {
  active?: boolean;
  intensity?: number; // 0-1
  size?: number;
  ringCount?: number;
  style?: ViewStyle;
}

export function VADIndicator({
  active = false,
  intensity = 0,
  size = 80,
  ringCount = 3,
  style,
}: VADIndicatorProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {Array.from({ length: ringCount }).map((_, index) => (
        <VADRing
          key={index}
          index={index}
          active={active}
          intensity={intensity}
          size={size}
          totalRings={ringCount}
          theme={theme}
          reduceMotion={reduceMotion}
        />
      ))}
      <View
        style={[
          styles.centerDot,
          {
            width: size * 0.15,
            height: size * 0.15,
            backgroundColor: active
              ? theme.colors.biolum.full
              : theme.colors.biolum.faint,
          },
        ]}
      />
    </View>
  );
}

interface VADRingProps {
  index: number;
  active: boolean;
  intensity: number;
  size: number;
  totalRings: number;
  theme: ReturnType<typeof useVoidTheme>;
  reduceMotion: boolean;
}

function VADRing({
  index,
  active,
  intensity,
  size,
  totalRings,
  theme,
  reduceMotion,
}: VADRingProps) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  const ringSize = size * (0.4 + (index / totalRings) * 0.6);
  const delay = index * 200;

  useEffect(() => {
    if (!active || reduceMotion) {
      scale.value = withTiming(0.8, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
      return;
    }

    const targetScale = 0.8 + intensity * 0.4;
    scale.value = withRepeat(
      withSequence(
        withTiming(targetScale, {
          duration: 800,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0.8, {
          duration: 800,
          easing: Easing.in(Easing.cubic),
        })
      ),
      -1,
      false
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8 * intensity, {
          duration: 800,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0.2 * intensity, {
          duration: 800,
          easing: Easing.in(Easing.cubic),
        })
      ),
      -1,
      false
    );
  }, [active, intensity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderColor: theme.colors.biolum.faint,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
  },
  centerDot: {
    borderRadius: 100,
  },
});

export default VADIndicator;
