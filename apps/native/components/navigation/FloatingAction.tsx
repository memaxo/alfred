import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Pressable, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";

export interface FloatingActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  breathing?: boolean;
  size?: number;
  disabled?: boolean;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FloatingAction({
  icon,
  onPress,
  breathing = true,
  size = 56,
  disabled = false,
  style,
}: FloatingActionProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const breatheScale = useSharedValue(1);

  React.useEffect(() => {
    if (breathing && !reduceMotion && !disabled) {
      breatheScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 2000 }),
          withTiming(1, { duration: 2000 })
        ),
        -1,
        false
      );
    } else {
      breatheScale.value = withTiming(1, { duration: 200 });
    }
  }, [breathing, reduceMotion, disabled]);

  const handlePressIn = () => {
    if (!reduceMotion) {
      scale.value = withSpring(0.9, { damping: 15 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * breatheScale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.glass.active,
          borderColor: "rgba(255, 255, 255, 0.20)",
          opacity: disabled ? 0.5 : 1,
        },
        theme.glow.medium,
        animatedStyle,
        style,
      ]}
      accessibilityRole="button"
    >
      <Ionicons
        name={icon}
        size={size * 0.45}
        color={theme.colors.biolum.full}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});

export default FloatingAction;
