import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { BiolumText, CaptionText } from "@/components/foundation/BiolumText";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { useVoidTheme } from "@/hooks/use-void-theme";

interface CommitmentsListProps {
  commitments: {
    id: string;
    title: string;
    progress: number;
    dueTime?: Date;
    completed: boolean;
  }[];
  onComplete: (id: string) => void;
}

interface CommitmentItemProps {
  commitment: CommitmentsListProps["commitments"][number];
  onComplete: (id: string) => void;
}

const CommitmentItem = React.memo(
  function CommitmentItem({ commitment, onComplete }: CommitmentItemProps) {
    const theme = useVoidTheme();
    const checked = useSharedValue(commitment.completed ? 1 : 0);

    React.useEffect(() => {
      checked.value = withSpring(commitment.completed ? 1 : 0, {
        damping: 15,
        stiffness: 100,
      });
    }, [commitment.completed, checked]);

    const handleComplete = useCallback(() => {
      onComplete(commitment.id);
    }, [commitment.id, onComplete]);

    const glowStyle = useAnimatedStyle(() => {
      const opacity = interpolate(checked.value, [0, 1], [0, 0.5]);
      const scale = interpolate(checked.value, [0, 1], [0.8, 1.2]);
      return {
        opacity,
        transform: [{ scale }],
      };
    });

    return (
      <HUDSurface elevation={1} style={styles.itemContainer}>
        <View style={styles.itemContent}>
          <Pressable
            onPress={handleComplete}
            style={({ pressed }) => [
              styles.checkbox,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: commitment.completed }}
            accessibilityLabel={`Mark ${commitment.title} as complete`}
          >
            <View
              style={[
                styles.checkboxInner,
                {
                  borderColor: commitment.completed
                    ? "#00FF88"
                    : theme.colors.glass.border,
                  backgroundColor: commitment.completed
                    ? "rgba(0, 255, 136, 0.2)"
                    : "transparent",
                },
              ]}
            >
              {commitment.completed && (
                <Ionicons name="checkmark" size={16} color="#00FF88" />
              )}
            </View>
            <Animated.View
              style={[
                styles.checkboxGlow,
                { backgroundColor: "#00FF88" },
                glowStyle,
              ]}
            />
          </Pressable>

          <View style={styles.textContainer}>
            <BiolumText
              variant="body"
              size="small"
              color={commitment.completed ? "dim" : "bright"}
              style={commitment.completed ? styles.completedText : undefined}
            >
              {commitment.title}
            </BiolumText>
            {commitment.dueTime && (
              <CaptionText size="small">
                Due{" "}
                {commitment.dueTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </CaptionText>
            )}
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${commitment.progress * 100}%`,
                    backgroundColor:
                      commitment.progress >= 1 ? "#00FF88" : "#00D9FF",
                  },
                ]}
              />
            </View>
            <BiolumText variant="caption" size="small" color="dim">
              {Math.round(commitment.progress * 100)}%
            </BiolumText>
          </View>
        </View>
      </HUDSurface>
    );
  },
  (prev, next) => {
    return (
      prev.commitment.id === next.commitment.id &&
      prev.commitment === next.commitment &&
      prev.onComplete === next.onComplete
    );
  }
);

export function CommitmentsList({
  commitments,
  onComplete,
}: CommitmentsListProps) {
  const activeCommitments = commitments.filter((c) => !c.completed);
  const completedCommitments = commitments.filter((c) => c.completed);

  return (
    <View style={styles.container}>
      <BiolumText
        variant="title"
        size="small"
        color="bright"
        style={styles.sectionHeader}
      >
        Today's Commitments
      </BiolumText>

      <View style={styles.listContainer}>
        {activeCommitments.map((commitment) => (
          <CommitmentItem
            key={commitment.id}
            commitment={commitment}
            onComplete={onComplete}
          />
        ))}

        {completedCommitments.length > 0 && (
          <>
            <CaptionText style={styles.completedHeader}>Completed</CaptionText>
            {completedCommitments.map((commitment) => (
              <CommitmentItem
                key={commitment.id}
                commitment={commitment}
                onComplete={onComplete}
              />
            ))}
          </>
        )}

        {commitments.length === 0 && (
          <HUDSurface elevation={1} style={styles.emptyContainer}>
            <CaptionText style={styles.emptyText}>
              No commitments for today
            </CaptionText>
          </HUDSurface>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  listContainer: {
    gap: 8,
  },
  itemContainer: {
    marginVertical: 4,
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  checkbox: {
    position: "relative",
    width: 28,
    height: 28,
    marginRight: 12,
  },
  checkboxInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxGlow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 18,
    opacity: 0,
  },
  textContainer: {
    flex: 1,
  },
  completedText: {
    textDecorationLine: "line-through",
  },
  progressContainer: {
    alignItems: "flex-end",
    gap: 4,
  },
  progressBarBackground: {
    width: 60,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  completedHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
  },
});

export default CommitmentsList;
