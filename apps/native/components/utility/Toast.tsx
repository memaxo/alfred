import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
  useSharedValue,
  runOnJS,
  SlideInUp,
  SlideOutUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastProps {
  id: string;
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

export function Toast({
  id,
  type = "info",
  title,
  message,
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const translateX = useSharedValue(0);

  const config = getTypeConfig(type, theme);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const swipeGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > 100) {
        translateX.value = withTiming(
          event.translationX > 0 ? 400 : -400,
          { duration: 200 },
          () => runOnJS(onDismiss)(id)
        );
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View
        entering={!reduceMotion ? SlideInUp.springify() : undefined}
        exiting={!reduceMotion ? SlideOutUp.springify() : undefined}
        style={[
          styles.container,
          {
            marginTop: insets.top + 8,
            backgroundColor: theme.colors.void.raised,
            borderColor: config.borderColor,
          },
          theme.glow.subtle,
          animatedStyle,
        ]}
      >
        <View
          style={[styles.indicator, { backgroundColor: config.indicatorColor }]}
        />
        <View style={styles.iconContainer}>
          <Ionicons name={config.icon} size={20} color={config.iconColor} />
        </View>
        <View style={styles.content}>
          <BiolumText
            variant="body"
            size="medium"
            color="full"
            numberOfLines={1}
          >
            {title}
          </BiolumText>
          {message && (
            <CaptionText size="medium" color="dim" numberOfLines={2}>
              {message}
            </CaptionText>
          )}
        </View>
        <Pressable onPress={() => onDismiss(id)} style={styles.closeButton}>
          <Ionicons name="close" size={18} color={theme.colors.biolum.faint} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function getTypeConfig(
  type: ToastType,
  theme: ReturnType<typeof useVoidTheme>
) {
  switch (type) {
    case "success":
      return {
        icon: "checkmark-circle" as const,
        iconColor: theme.colors.semantic.success,
        indicatorColor: theme.colors.semantic.success,
        borderColor: "rgba(145, 200, 145, 0.3)",
      };
    case "warning":
      return {
        icon: "warning" as const,
        iconColor: theme.colors.semantic.warning,
        indicatorColor: theme.colors.semantic.warning,
        borderColor: "rgba(200, 180, 145, 0.3)",
      };
    case "error":
      return {
        icon: "alert-circle" as const,
        iconColor: theme.colors.semantic.error,
        indicatorColor: theme.colors.semantic.error,
        borderColor: "rgba(200, 145, 145, 0.3)",
      };
    default:
      return {
        icon: "information-circle" as const,
        iconColor: theme.colors.semantic.info,
        indicatorColor: theme.colors.semantic.info,
        borderColor: "rgba(145, 170, 200, 0.3)",
      };
  }
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  indicator: {
    width: 4,
    alignSelf: "stretch",
  },
  iconContainer: {
    padding: 12,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 8,
    gap: 2,
  },
  closeButton: {
    padding: 12,
  },
});

export default Toast;
