import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { BiolumText, CaptionText } from "@/components/foundation/BiolumText";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { useVoidTheme } from "@/hooks/use-void-theme";

interface CognitiveStateCardProps {
  physiology: {
    energy: number;
    stress: number;
    focus: number;
    load: number;
  };
}

interface MetricBarProps {
  label: string;
  value: number;
  color: string;
  invert?: boolean;
  warning?: boolean;
}

function MetricBar({ label, value, color, invert, warning }: MetricBarProps) {
  const theme = useVoidTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(value, {
      damping: 15,
      stiffness: 100,
    });
  }, [value, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const clampedValue = Math.max(0, Math.min(1, progress.value));
    return {
      width: `${clampedValue * 100}%`,
      opacity: interpolate(clampedValue, [0, 0.5, 1], [0.5, 0.8, 1]),
    };
  });

  const displayValue = invert ? 1 - value : value;
  const displayPercent = Math.round(displayValue * 100);

  return (
    <View style={styles.metricContainer}>
      <View style={styles.metricHeader}>
        <BiolumText variant="caption" size="small" color="dim">
          {label}
        </BiolumText>
        <BiolumText
          variant="caption"
          size="small"
          color={warning && value > 0.8 ? "bright" : "dim"}
        >
          {displayPercent}%
        </BiolumText>
      </View>
      <View
        style={[
          styles.barBackground,
          { backgroundColor: theme.colors.glass.border },
        ]}
      >
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: warning && value > 0.8 ? "#FFB800" : color,
            },
            animatedStyle,
          ]}
        />
      </View>
    </View>
  );
}

export function CognitiveStateCard({ physiology }: CognitiveStateCardProps) {
  const theme = useVoidTheme();

  const getEnergyColor = (value: number) => {
    if (value > 0.7) {
      return "#00FF88";
    }
    if (value > 0.4) {
      return "#FFB800";
    }
    return "#FF4444";
  };

  const getStressColor = (value: number) => {
    if (value < 0.3) {
      return "#00FF88";
    }
    if (value < 0.6) {
      return "#FFB800";
    }
    return "#FF4444";
  };

  return (
    <HUDSurface elevation={2} style={styles.container}>
      <View style={styles.content}>
        <BiolumText variant="title" size="small" color="bright">
          Physiology
        </BiolumText>

        <View style={styles.metricsContainer}>
          <MetricBar
            label="Energy"
            value={physiology.energy}
            color={getEnergyColor(physiology.energy)}
          />

          <MetricBar
            label="Stress"
            value={physiology.stress}
            color={getStressColor(physiology.stress)}
            invert
          />

          <MetricBar label="Focus" value={physiology.focus} color="#00D9FF" />

          <MetricBar
            label="Load"
            value={physiology.load}
            color={physiology.load > 0.8 ? "#FF4444" : "#00D9FF"}
            warning={physiology.load > 0.8}
          />
        </View>
      </View>
    </HUDSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  content: {
    padding: 16,
  },
  metricsContainer: {
    marginTop: 12,
    gap: 12,
  },
  metricContainer: {
    gap: 4,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  barBackground: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
});

export default CognitiveStateCard;
