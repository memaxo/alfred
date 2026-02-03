import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "@/hooks/use-void-theme";

interface BiolumOrbProps {
  size?: number;
  pulsing?: boolean;
  active?: boolean;
  style?: View["props"]["style"];
}

export function BiolumOrb({
  size = 200,
  pulsing = true,
  active = false,
  style,
}: BiolumOrbProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();

  const breathePhase = useSharedValue(0);
  const glowPhase = useSharedValue(0);
  const activePulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      breathePhase.value = 0.5;
      glowPhase.value = 0.5;
      return;
    }

    if (pulsing) {
      breathePhase.value = withRepeat(
        withTiming(1, {
          duration: 4000,
          easing: Easing.bezier(0.25, 0.4, 0.25, 1),
        }),
        -1,
        true
      );

      glowPhase.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 2000 }),
          withTiming(0.7, { duration: 2000 })
        ),
        -1,
        true
      );
    }

    if (active) {
      activePulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0, { duration: 800 })
        ),
        -1,
        true
      );
    }
  }, [pulsing, active, reduceMotion, breathePhase, glowPhase, activePulse]);

  const orbAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(breathePhase.value, [0, 1], [1, 1.05]);
    const opacity = interpolate(breathePhase.value, [0, 1], [0.9, 1]);

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const glowAnimatedStyle = useAnimatedStyle(() => {
    const glowOpacity = interpolate(glowPhase.value, [0, 1], [0.3, 0.6]);

    return {
      opacity: glowOpacity,
    };
  });

  const coreAnimatedStyle = useAnimatedStyle(() => {
    const coreOpacity = interpolate(breathePhase.value, [0, 1], [0.8, 1]);

    return {
      opacity: coreOpacity,
    };
  });

  const pulseRingStyle = useAnimatedStyle(() => {
    if (!active) return { opacity: 0, transform: [{ scale: 1 }] };

    const scale = interpolate(activePulse.value, [0, 1], [1, 1.3]);
    const opacity = interpolate(activePulse.value, [0, 1], [0.5, 0]);

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: (size * 1.4) / 2,
            backgroundColor: "rgba(0, 217, 255, 0.1)",
          },
          glowAnimatedStyle,
        ]}
      />

      {/* Pulse ring when active */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: "rgba(0, 217, 255, 0.5)",
          },
          pulseRingStyle,
        ]}
      />

      {/* Main orb */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "rgba(0, 217, 255, 0.15)",
            shadowColor: "#00D9FF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 40,
          },
          orbAnimatedStyle,
        ]}
      >
        {/* Inner core */}
        <Animated.View
          style={[
            styles.core,
            {
              width: size * 0.4,
              height: size * 0.4,
              borderRadius: (size * 0.4) / 2,
              backgroundColor: "rgba(0, 217, 255, 0.8)",
              shadowColor: "#00D9FF",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 20,
            },
            coreAnimatedStyle,
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  orb: {
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
  },
  core: {
    elevation: 15,
  },
});

export default BiolumOrb;
