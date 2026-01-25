import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  runOnJS,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";

export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked";

export interface TaskProps {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate?: string;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: TaskStatus) => void;
}

export function Task({
  id,
  title,
  description,
  status,
  dueDate,
  onPress,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const actionOpacity = useSharedValue(0);

  const statusConfig = getStatusConfig(status, theme);

  const handleStatusToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (status === "completed") {
      onStatusChange?.("pending");
    } else if (status === "pending" || status === "in_progress") {
      onStatusChange?.("completed");
    }
  };

  const swipeGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -120);
        actionOpacity.value = Math.min(Math.abs(event.translationX) / 60, 1);
      }
    })
    .onEnd((event) => {
      if (event.translationX < -60) {
        translateX.value = withTiming(-120);
        actionOpacity.value = withTiming(1);
      } else {
        translateX.value = withTiming(0);
        actionOpacity.value = withTiming(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: actionOpacity.value,
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.actionsContainer, actionStyle]}>
        {onEdit && (
          <Pressable
            onPress={onEdit}
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.semantic.info },
            ]}
          >
            <Ionicons name="pencil" size={20} color={theme.colors.void.deep} />
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            onPress={onDelete}
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.semantic.error },
            ]}
          >
            <Ionicons name="trash" size={20} color={theme.colors.void.deep} />
          </Pressable>
        )}
      </Animated.View>

      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={animatedStyle}>
          <HUDSurface elevation={1} style={styles.container}>
            <Pressable
              onPress={handleStatusToggle}
              style={styles.checkbox}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: status === "completed" }}
            >
              <View
                style={[
                  styles.checkboxInner,
                  {
                    borderColor: statusConfig.checkboxBorder,
                    backgroundColor:
                      status === "completed"
                        ? statusConfig.checkboxBorder
                        : "transparent",
                  },
                ]}
              >
                {status === "completed" && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={theme.colors.void.deep}
                  />
                )}
              </View>
            </Pressable>

            <Pressable onPress={onPress} style={styles.content}>
              <View style={styles.titleRow}>
                <BiolumText
                  variant="body"
                  size="medium"
                  color={status === "completed" ? "dim" : "full"}
                  style={
                    status === "completed" ? styles.completedText : undefined
                  }
                  numberOfLines={1}
                >
                  {title}
                </BiolumText>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusConfig.badgeBg },
                  ]}
                >
                  <CaptionText size="small" color="standard">
                    {statusConfig.label}
                  </CaptionText>
                </View>
              </View>
              {description && (
                <CaptionText
                  size="medium"
                  color="dim"
                  numberOfLines={2}
                  style={styles.description}
                >
                  {description}
                </CaptionText>
              )}
              {dueDate && (
                <View style={styles.dueDateRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={12}
                    color={theme.colors.biolum.faint}
                  />
                  <CaptionText size="small" color="faint">
                    {dueDate}
                  </CaptionText>
                </View>
              )}
            </Pressable>
          </HUDSurface>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function getStatusConfig(
  status: TaskStatus,
  theme: ReturnType<typeof useVoidTheme>
) {
  switch (status) {
    case "pending": {
      return {
        label: "To Do",
        badgeBg: theme.colors.glass.surface,
        checkboxBorder: theme.colors.biolum.faint,
      };
    }
    case "in_progress": {
      return {
        label: "In Progress",
        badgeBg: theme.colors.glass.hover,
        checkboxBorder: theme.colors.biolum.standard,
      };
    }
    case "completed": {
      return {
        label: "Done",
        badgeBg: "rgba(145, 200, 145, 0.2)",
        checkboxBorder: theme.colors.semantic.success,
      };
    }
    case "blocked": {
      return {
        label: "Blocked",
        badgeBg: "rgba(200, 145, 145, 0.2)",
        checkboxBorder: theme.colors.semantic.error,
      };
    }
  }
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
  },
  actionsContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
  },
  checkbox: {
    padding: 4,
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  description: {
    marginTop: 4,
  },
  dueDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  completedText: {
    textDecorationLine: "line-through",
  },
});

export default Task;
