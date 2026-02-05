import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion, useVoidTheme } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";
import { Progress } from "./Progress";

export interface PlanPhase {
  id: string;
  title: string;
  status: "pending" | "active" | "completed";
  subtasks?: PlanSubtask[];
}

export interface PlanSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface PlanProps {
  title: string;
  phases: PlanPhase[];
  progress?: number;
  onPhasePress?: (phaseId: string) => void;
  defaultExpanded?: boolean;
}

export function Plan({
  title,
  phases,
  progress,
  onPhasePress,
  defaultExpanded = true,
}: PlanProps) {
  const theme = useVoidTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(expanded ? 1 : 0);

  const completedPhases = phases.filter((p) => p.status === "completed").length;
  const calculatedProgress =
    progress ?? (completedPhases / phases.length) * 100;

  const toggleExpanded = () => {
    setExpanded(!expanded);
    rotation.value = withTiming(expanded ? 0 : 1, { duration: 200 });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 90}deg` }],
  }));

  return (
    <HUDSurface elevation={1} style={styles.container}>
      <Pressable onPress={toggleExpanded} style={styles.header}>
        <View style={styles.headerLeft}>
          <Animated.View style={chevronStyle}>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.colors.biolum.dim}
            />
          </Animated.View>
          <BiolumText variant="title" size="medium" color="full">
            {title}
          </BiolumText>
        </View>
        <Progress
          value={calculatedProgress}
          variant="radial"
          size={40}
          showLabel={false}
        />
      </Pressable>

      {expanded && (
        <View style={styles.content}>
          {phases.map((phase, index) => (
            <PhaseItem
              key={phase.id}
              phase={phase}
              index={index}
              isLast={index === phases.length - 1}
              onPress={onPhasePress ? () => onPhasePress(phase.id) : undefined}
              theme={theme}
            />
          ))}
        </View>
      )}
    </HUDSurface>
  );
}

interface PhaseItemProps {
  phase: PlanPhase;
  index: number;
  isLast: boolean;
  onPress?: () => void;
  theme: ReturnType<typeof useVoidTheme>;
}

function PhaseItem({ phase, index, isLast, onPress, theme }: PhaseItemProps) {
  const [subtasksExpanded, setSubtasksExpanded] = useState(
    phase.status === "active"
  );

  const statusConfig = getStatusConfig(phase.status, theme);

  return (
    <View style={styles.phaseContainer}>
      <View style={styles.phaseIndicatorColumn}>
        <View
          style={[
            styles.phaseIndicator,
            {
              backgroundColor: statusConfig.bgColor,
              borderColor: statusConfig.borderColor,
            },
          ]}
        >
          {phase.status === "completed" && (
            <Ionicons
              name="checkmark"
              size={12}
              color={theme.colors.semantic.success}
            />
          )}
          {phase.status === "active" && (
            <View
              style={[
                styles.activeDot,
                { backgroundColor: theme.colors.biolum.full },
              ]}
            />
          )}
        </View>
        {!isLast && (
          <View
            style={[
              styles.phaseConnector,
              { backgroundColor: theme.colors.glass.border },
            ]}
          />
        )}
      </View>

      <Pressable
        onPress={() => {
          if (phase.subtasks?.length) {
            setSubtasksExpanded(!subtasksExpanded);
          }
          onPress?.();
        }}
        style={styles.phaseContent}
      >
        <BiolumText
          variant="body"
          size="medium"
          color={
            phase.status === "active"
              ? "full"
              : (phase.status === "completed"
                ? "standard"
                : "dim")
          }
        >
          {phase.title}
        </BiolumText>

        {subtasksExpanded && phase.subtasks && (
          <View style={styles.subtasks}>
            {phase.subtasks.map((subtask) => (
              <View key={subtask.id} style={styles.subtaskRow}>
                <Ionicons
                  name={subtask.completed ? "checkbox" : "square-outline"}
                  size={16}
                  color={
                    subtask.completed
                      ? theme.colors.semantic.success
                      : theme.colors.biolum.faint
                  }
                />
                <CaptionText
                  size="medium"
                  color={subtask.completed ? "dim" : "faint"}
                  style={subtask.completed ? styles.completedText : undefined}
                >
                  {subtask.title}
                </CaptionText>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    </View>
  );
}

function getStatusConfig(
  status: "pending" | "active" | "completed",
  theme: ReturnType<typeof useVoidTheme>
) {
  switch (status) {
    case "pending": {
      return {
        bgColor: "transparent",
        borderColor: theme.colors.biolum.faint,
      };
    }
    case "active": {
      return {
        bgColor: theme.colors.glass.active,
        borderColor: theme.colors.biolum.standard,
      };
    }
    case "completed": {
      return {
        bgColor: "rgba(145, 200, 145, 0.2)",
        borderColor: theme.colors.semantic.success,
      };
    }
  }
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  phaseContainer: {
    flexDirection: "row",
  },
  phaseIndicatorColumn: {
    width: 24,
    alignItems: "center",
  },
  phaseIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  phaseConnector: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  phaseContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  subtasks: {
    marginTop: 8,
    gap: 6,
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  completedText: {
    textDecorationLine: "line-through",
  },
});

export default Plan;
