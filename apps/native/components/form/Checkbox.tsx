import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText } from "../foundation/BiolumText";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  indeterminate?: boolean;
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  indeterminate = false,
}: CheckboxProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const handlePress = () => {
    if (disabled) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(!checked);
    if (!reduceMotion) {
      scale.value = withSpring(0.9, { damping: 15 });
      scale.value = withSpring(1, { damping: 15 });
      glowOpacity.value = withTiming(0.3, { duration: 100 });
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  const borderColor = disabled
    ? theme.colors.biolum.whisper
    : checked || indeterminate
      ? theme.colors.biolum.standard
      : theme.colors.biolum.faint;

  const backgroundColor =
    checked || indeterminate ? theme.colors.glass.active : "transparent";

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={styles.container}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      <Animated.View
        style={[
          styles.checkbox,
          {
            borderColor,
            backgroundColor,
            shadowColor: theme.colors.biolum.full,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 8,
            elevation: 1,
          },
          animatedStyle,
          glowStyle,
        ]}
      >
        {checked && (
          <Ionicons
            name="checkmark"
            size={16}
            color={theme.colors.biolum.full}
          />
        )}
        {indeterminate && !checked && (
          <View
            style={[
              styles.indeterminate,
              { backgroundColor: theme.colors.biolum.full },
            ]}
          />
        )}
      </Animated.View>
      {label && (
        <BiolumText
          variant="body"
          size="medium"
          color={disabled ? "faint" : "standard"}
          style={styles.label}
        >
          {label}
        </BiolumText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  indeterminate: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
  label: {
    marginLeft: 12,
    flex: 1,
  },
});

export default Checkbox;
