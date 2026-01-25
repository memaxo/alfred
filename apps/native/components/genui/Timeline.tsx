import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  FadeIn,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";

export type TimelineItemStatus = "pending" | "active" | "completed" | "error";

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  status: TimelineItemStatus;
  timestamp?: string;
  children?: TimelineItem[];
}

export interface TimelineProps {
  items: TimelineItem[];
  onItemPress?: (item: TimelineItem) => void;
  showConnectors?: boolean;
}

export function Timeline({
  items,
  onItemPress,
  showConnectors = true,
}: TimelineProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();

  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <Animated.View
            key={item.id}
            entering={!reduceMotion ? FadeIn.delay(index * 100) : undefined}
          >
            <TimelineItemRow
              item={item}
              isLast={isLast}
              onPress={onItemPress ? () => onItemPress(item) : undefined}
              showConnector={showConnectors}
              theme={theme}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

interface TimelineItemRowProps {
  item: TimelineItem;
  isLast: boolean;
  onPress?: () => void;
  showConnector: boolean;
  theme: ReturnType<typeof useVoidTheme>;
}

function TimelineItemRow({
  item,
  isLast,
  onPress,
  showConnector,
  theme,
}: TimelineItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const bgOpacity = useSharedValue(0);

  const statusConfig = getStatusConfig(item.status, theme);
  const hasChildren = item.children && item.children.length > 0;

  const handlePress = () => {
    if (hasChildren) {
      setExpanded(!expanded);
    }
    onPress?.();
  };

  const handlePressIn = () => {
    if (!reduceMotion) {
      bgOpacity.value = withTiming(1, { duration: 100 });
    }
  };

  const handlePressOut = () => {
    bgOpacity.value = withTiming(0, { duration: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255, 255, 255, ${0.03 * bgOpacity.value})`,
  }));

  return (
    <View style={styles.itemContainer}>
      <View style={styles.indicatorColumn}>
        <View
          style={[
            styles.indicator,
            {
              backgroundColor: statusConfig.indicatorBg,
              borderColor: statusConfig.indicatorBorder,
            },
          ]}
        >
          {statusConfig.icon && (
            <Ionicons
              name={statusConfig.icon}
              size={12}
              color={statusConfig.iconColor}
            />
          )}
        </View>
        {showConnector && !isLast && (
          <View
            style={[
              styles.connector,
              { backgroundColor: theme.colors.glass.border },
            ]}
          />
        )}
      </View>

      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.contentContainer}
      >
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={styles.header}>
            <BiolumText
              variant="body"
              size="medium"
              color={item.status === "active" ? "full" : "standard"}
            >
              {item.title}
            </BiolumText>
            {item.timestamp && (
              <CaptionText size="small" color="faint">
                {item.timestamp}
              </CaptionText>
            )}
          </View>
          {item.description && (
            <CaptionText size="medium" color="dim" style={styles.description}>
              {item.description}
            </CaptionText>
          )}
          {hasChildren && (
            <View style={styles.expandIndicator}>
              <CaptionText size="small" color="faint">
                {expanded ? "Hide" : "Show"} {item.children!.length} items
              </CaptionText>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={theme.colors.biolum.faint}
              />
            </View>
          )}
        </Animated.View>
      </Pressable>

      {expanded && hasChildren && (
        <View style={styles.childrenContainer}>
          <Timeline items={item.children!} showConnectors={showConnector} />
        </View>
      )}
    </View>
  );
}

function getStatusConfig(
  status: TimelineItemStatus,
  theme: ReturnType<typeof useVoidTheme>
) {
  switch (status) {
    case "pending": {
      return {
        indicatorBg: "transparent",
        indicatorBorder: theme.colors.biolum.faint,
        icon: undefined,
        iconColor: undefined,
      };
    }
    case "active": {
      return {
        indicatorBg: theme.colors.glass.active,
        indicatorBorder: theme.colors.biolum.standard,
        icon: "ellipse" as const,
        iconColor: theme.colors.biolum.full,
      };
    }
    case "completed": {
      return {
        indicatorBg: "rgba(145, 200, 145, 0.2)",
        indicatorBorder: theme.colors.semantic.success,
        icon: "checkmark" as const,
        iconColor: theme.colors.semantic.success,
      };
    }
    case "error": {
      return {
        indicatorBg: "rgba(200, 145, 145, 0.2)",
        indicatorBorder: theme.colors.semantic.error,
        icon: "close" as const,
        iconColor: theme.colors.semantic.error,
      };
    }
  }
}

const styles = StyleSheet.create({
  container: {},
  itemContainer: {
    flexDirection: "row",
  },
  indicatorColumn: {
    width: 24,
    alignItems: "center",
  },
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  connector: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  contentContainer: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  content: {
    padding: 8,
    borderRadius: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  description: {
    marginTop: 4,
  },
  expandIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  childrenContainer: {
    marginLeft: 36,
    marginTop: -8,
  },
});

export default Timeline;
