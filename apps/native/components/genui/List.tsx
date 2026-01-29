import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import React, { memo, useCallback } from "react";
import { StyleSheet, View, Pressable, RefreshControl } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";
import { SignalDivider } from "../foundation/SignalDivider";

export interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightText?: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
}

export interface ListProps {
  items: ListItem[];
  onItemPress?: (item: ListItem) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  emptyText?: string;
  showDividers?: boolean;
  animated?: boolean;
}

export function List({
  items,
  onItemPress,
  onRefresh,
  refreshing = false,
  emptyIcon = "folder-open-outline",
  emptyText = "No items",
  showDividers = true,
  animated = true,
}: ListProps) {
  const theme = useVoidTheme();
  const reduceMotion = useReducedMotion();

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name={emptyIcon}
          size={48}
          color={theme.colors.biolum.faint}
        />
        <BiolumText
          variant="body"
          size="medium"
          color="dim"
          style={styles.emptyText}
        >
          {emptyText}
        </BiolumText>
      </View>
    );
  }

  const renderItem = useCallback(
    ({ item, index }: { item: ListItem; index: number }) => {
      const isLast = index === items.length - 1;

      return (
        <Animated.View
          entering={
            animated && !reduceMotion ? FadeIn.delay(index * 50) : undefined
          }
          exiting={animated && !reduceMotion ? FadeOut : undefined}
        >
          <MemoizedListItemRow
            item={item}
            onPress={onItemPress ? () => onItemPress(item) : undefined}
            theme={theme}
          />
          {showDividers && !isLast && (
            <SignalDivider animate={false} color={theme.colors.glass.border} />
          )}
        </Animated.View>
      );
    },
    [items.length, animated, reduceMotion, onItemPress, theme, showDividers]
  );

  return (
    <FlashList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      // @ts-expect-error - estimatedItemSize exists at runtime but not in types for v2.2.0
      estimatedItemSize={60}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.biolum.dim}
          />
        ) : undefined
      }
    />
  );
}

interface ListItemRowProps {
  item: ListItem;
  onPress?: () => void;
  theme: ReturnType<typeof useVoidTheme>;
}

const MemoizedListItemRow = memo(
  function ListItemRow({ item, onPress, theme }: ListItemRowProps) {
    const reduceMotion = useReducedMotion();
    const bgOpacity = useSharedValue(0);

    const handlePressIn = () => {
      if (!reduceMotion) {
        bgOpacity.value = withTiming(1, { duration: 100 });
      }
    };

    const handlePressOut = () => {
      bgOpacity.value = withTiming(0, { duration: 200 });
    };

    const animatedStyle = useAnimatedStyle(() => ({
      backgroundColor: `rgba(255, 255, 255, ${0.05 * bgOpacity.value})`,
    }));

    const content = (
      <Animated.View style={[styles.itemRow, animatedStyle]}>
        {item.icon && (
          <View style={styles.iconContainer}>
            <Ionicons
              name={item.icon}
              size={20}
              color={theme.colors.biolum.dim}
            />
          </View>
        )}
        <View style={styles.textContainer}>
          <BiolumText
            variant="body"
            size="medium"
            color="standard"
            numberOfLines={1}
          >
            {item.title}
          </BiolumText>
          {item.subtitle && (
            <CaptionText size="medium" color="dim" numberOfLines={1}>
              {item.subtitle}
            </CaptionText>
          )}
        </View>
        <View style={styles.rightContainer}>
          {item.rightText && (
            <CaptionText size="medium" color="faint">
              {item.rightText}
            </CaptionText>
          )}
          {item.rightIcon && (
            <Ionicons
              name={item.rightIcon}
              size={16}
              color={theme.colors.biolum.faint}
            />
          )}
        </View>
      </Animated.View>
    );

    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          {content}
        </Pressable>
      );
    }

    return content;
  },
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item === next.item &&
    prev.onPress === next.onPress &&
    prev.theme === next.theme
);

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 12,
  },
});

export default List;
