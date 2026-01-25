import type { ViewStyle } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";

export interface NumberProps {
  value: number;
  previousValue?: number;
  label?: string;
  format?: "number" | "currency" | "percent" | "compact";
  prefix?: string;
  suffix?: string;
  decimals?: number;
  animate?: boolean;
  showTrend?: boolean;
  style?: ViewStyle;
}

export function Number({
  value,
  previousValue,
  label,
  format = "number",
  prefix = "",
  suffix = "",
  decimals = 0,
  animate = true,
  showTrend = true,
  style,
}: NumberProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(
    animate && !reduceMotion ? 0 : value
  );
  const animatedValue = useSharedValue(animate && !reduceMotion ? 0 : value);

  const trend = previousValue !== undefined ? value - previousValue : 0;
  const trendPercent =
    previousValue !== undefined && previousValue !== 0
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : 0;

  useEffect(() => {
    if (animate && !reduceMotion) {
      animatedValue.value = withTiming(value, {
        duration: 1000,
      });

      // Update display value during animation
      const duration = 1000;
      const startValue = displayValue;
      const startTime = Date.now();

      const updateValue = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue =
          startValue + (value - startValue) * easeOutCubic(progress);
        setDisplayValue(currentValue);

        if (progress < 1) {
          requestAnimationFrame(updateValue);
        } else {
          setDisplayValue(value);
        }
      };

      requestAnimationFrame(updateValue);
    } else {
      setDisplayValue(value);
    }
  }, [value, animate, reduceMotion]);

  const formattedValue = formatNumber(displayValue, format, decimals);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <CaptionText size="medium" color="dim" style={styles.label}>
          {label}
        </CaptionText>
      )}
      <View style={styles.valueRow}>
        <BiolumText variant="title" size="large" color="full">
          {prefix}
          {formattedValue}
          {suffix}
        </BiolumText>
        {showTrend && trend !== 0 && (
          <TrendIndicator
            trend={trend}
            trendPercent={trendPercent}
            theme={theme}
          />
        )}
      </View>
    </View>
  );
}

interface TrendIndicatorProps {
  trend: number;
  trendPercent: number;
  theme: ReturnType<typeof useVoidTheme>;
}

function TrendIndicator({ trend, trendPercent, theme }: TrendIndicatorProps) {
  const isPositive = trend > 0;
  const icon = isPositive ? "arrow-up" : "arrow-down";
  const color = isPositive
    ? theme.colors.semantic.success
    : theme.colors.semantic.error;

  return (
    <View style={styles.trendContainer}>
      <Ionicons name={icon} size={14} color={color} />
      <BiolumText variant="caption" size="medium" color="dim" style={{ color }}>
        {Math.abs(trendPercent).toFixed(1)}%
      </BiolumText>
    </View>
  );
}

function formatNumber(
  value: number,
  format: "number" | "currency" | "percent" | "compact",
  decimals: number
): string {
  switch (format) {
    case "currency": {
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    case "percent": {
      return value.toLocaleString("en-US", {
        style: "percent",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    case "compact": {
      return Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    }
    default: {
      return value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  label: {
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
});

export default Number;
