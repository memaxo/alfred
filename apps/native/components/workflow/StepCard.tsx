import type { ViewStyle, TextStyle } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";

import {
  BiolumText,
  TitleText,
  BodyText,
  CaptionText,
} from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";

export interface WorkflowStep {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

interface StepCardProps {
  step: WorkflowStep;
  isActive: boolean;
  isLast: boolean;
  index: number;
}

const STATUS_COLORS = {
  pending: "#5A6B7D",
  running: "#00D9FF",
  success: "#00FF88",
  failed: "#FF4444",
  skipped: "#8B8B8B",
};

const STATUS_ICONS: Record<
  string,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  pending: "ellipse-outline",
  running: "sync",
  success: "checkmark-circle",
  failed: "close-circle",
  skipped: "arrow-forward-circle-outline",
};

export function StepCard({ step, isActive, isLast, index }: StepCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const spinAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (step.status === "running") {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [step.status, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const formatDuration = useCallback(() => {
    if (step.status === "running") {
      return "Running...";
    }
    if (step.status === "pending") {
      return "Pending";
    }
    if (step.startedAt && step.completedAt) {
      const duration =
        new Date(step.completedAt).getTime() -
        new Date(step.startedAt).getTime();
      if (duration < 1000) {
        return `${duration}ms`;
      }
      if (duration < 60000) {
        return `${Math.round(duration / 1000)}s`;
      }
      return `${Math.round(duration / 60000)}m ${Math.round((duration % 60000) / 1000)}s`;
    }
    return "—";
  }, [step]);

  const statusColor = STATUS_COLORS[step.status];
  const statusIcon = STATUS_ICONS[step.status];

  return (
    <View style={styles.container}>
      {/* Timeline connector */}
      {!isLast && (
        <View
          style={[
            styles.connector,
            {
              backgroundColor:
                step.status === "success" || step.status === "skipped"
                  ? "#00D9FF"
                  : "#5A6B7D",
            },
          ]}
        />
      )}

      {/* Status dot */}
      <View
        style={[
          styles.statusDot,
          {
            backgroundColor: statusColor,
            shadowColor: statusColor,
          },
          step.status === "running" && styles.pulsingDot,
        ]}
      >
        {step.status === "running" ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync" size={12} color="#0A0F14" />
          </Animated.View>
        ) : (
          <Ionicons name={statusIcon} size={12} color="#0A0F14" />
        )}
      </View>

      {/* Content card */}
      <HUDSurface elevation={1} style={styles.card}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <CaptionText mono style={styles.stepNumber}>
                {String(index + 1).padStart(2, "0")}
              </CaptionText>
              <BodyText
                color={isActive ? "bright" : "standard"}
                style={styles.stepName}
              >
                {step.name}
              </BodyText>
            </View>
            <CaptionText mono style={{ marginLeft: 8, color: statusColor }}>
              {formatDuration()}
            </CaptionText>
          </View>

          {/* Error details (expandable) */}
          {step.error && (
            <>
              <Pressable
                onPress={() => setExpanded(!expanded)}
                style={styles.errorHeader}
              >
                <Ionicons
                  name="warning"
                  size={14}
                  color="#FF4444"
                  style={styles.errorIcon}
                />
                <CaptionText color="dim" style={styles.errorToggle}>
                  {expanded ? "Hide details" : "Show error details"}
                </CaptionText>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="#8B8B8B"
                />
              </Pressable>
              {expanded && (
                <View style={styles.errorContainer}>
                  <CaptionText mono style={styles.errorText}>
                    {step.error}
                  </CaptionText>
                </View>
              )}
            </>
          )}
        </View>
      </HUDSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  connector: {
    position: "absolute",
    left: 11,
    top: 24,
    width: 2,
    height: "100%",
    opacity: 0.5,
  },
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  pulsingDot: {
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  card: {
    flex: 1,
    padding: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  stepNumber: {
    marginRight: 8,
    opacity: 0.6,
  },
  stepName: {
    flex: 1,
  },
  duration: {
    marginLeft: 8,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 68, 68, 0.2)",
  },
  errorIcon: {
    marginRight: 6,
  },
  errorToggle: {
    flex: 1,
  },
  errorContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    borderRadius: 4,
  },
  errorText: {
    color: "#FF6666",
  },
});

export default StepCard;
