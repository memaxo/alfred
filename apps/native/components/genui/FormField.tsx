import type { ViewStyle } from "react-native";

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { CaptionText } from "../foundation/BiolumText";

export interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  focused?: boolean;
  hasValue?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function FormField({
  label,
  error,
  hint,
  required = false,
  focused = false,
  hasValue = false,
  children,
  style,
}: FormFieldProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const labelPosition = useSharedValue(hasValue || focused ? 1 : 0);

  useEffect(() => {
    labelPosition.value = withTiming(hasValue || focused ? 1 : 0, {
      duration: 150,
    });
  }, [hasValue, focused]);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(labelPosition.value, [0, 1], [12, -8]) },
      { scale: interpolate(labelPosition.value, [0, 1], [1, 0.85]) },
    ],
  }));

  const borderColor = error
    ? theme.colors.semantic.error
    : focused
      ? theme.colors.biolum.standard
      : theme.colors.glass.border;

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor: theme.colors.glass.surface,
          },
        ]}
      >
        <Animated.View style={[styles.label, labelStyle]} pointerEvents="none">
          <CaptionText
            size="medium"
            color={error ? "faint" : focused ? "standard" : "dim"}
          >
            {label}
            {required && " *"}
          </CaptionText>
        </Animated.View>
        {children}
      </View>
      {(error || hint) && (
        <View style={styles.helperContainer}>
          {error ? (
            <CaptionText
              size="small"
              color="faint"
              style={{ color: theme.colors.semantic.error }}
            >
              {error}
            </CaptionText>
          ) : hint ? (
            <CaptionText size="small" color="faint">
              {hint}
            </CaptionText>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingTop: 8,
    position: "relative",
  },
  label: {
    position: "absolute",
    left: 12,
    top: 0,
    backgroundColor: "transparent",
    zIndex: 1,
  },
  helperContainer: {
    marginTop: 4,
    paddingHorizontal: 12,
  },
});

export default FormField;
