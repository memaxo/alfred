import React from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  ListRenderItemInfo,
  type DimensionValue,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText } from "../foundation/BiolumText";

export interface GridColumn {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
}

export interface GridRow {
  id: string;
  [key: string]: unknown;
}

export interface GridProps {
  columns: GridColumn[];
  data: GridRow[];
  onRowPress?: (row: GridRow) => void;
  showHeader?: boolean;
  striped?: boolean;
}

export function Grid({
  columns,
  data,
  onRowPress,
  showHeader = true,
  striped = false,
}: GridProps) {
  const theme = useVoidTheme();

  const renderHeader = () => {
    if (!showHeader) return null;

    return (
      <View
        style={[
          styles.headerRow,
          { backgroundColor: theme.colors.glass.hover },
        ]}
      >
        {columns.map((col) => (
          <View
            key={col.key}
            style={[
              styles.cell,
              col.width ? { width: col.width } : { flex: 1 },
            ]}
          >
            <BiolumText
              variant="caption"
              size="large"
              color="standard"
              style={{
                textAlign: (col.align ?? "left") as "left" | "center" | "right",
              }}
            >
              {col.header}
            </BiolumText>
          </View>
        ))}
      </View>
    );
  };

  const renderRow = ({ item, index }: ListRenderItemInfo<GridRow>) => {
    const isEven = index % 2 === 0;
    const backgroundColor =
      striped && isEven ? theme.colors.glass.surface : "transparent";

    return (
      <GridRowItem
        row={item}
        columns={columns}
        onPress={onRowPress ? () => onRowPress(item) : undefined}
        backgroundColor={backgroundColor}
        theme={theme}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={data}
        renderItem={renderRow}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    </View>
  );
}

interface GridRowItemProps {
  row: GridRow;
  columns: GridColumn[];
  onPress?: () => void;
  backgroundColor: string;
  theme: ReturnType<typeof useVoidTheme>;
}

function GridRowItem({
  row,
  columns,
  onPress,
  backgroundColor,
  theme,
}: GridRowItemProps) {
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
    backgroundColor:
      bgOpacity.value > 0
        ? `rgba(255, 255, 255, ${0.05 * bgOpacity.value})`
        : backgroundColor,
  }));

  const content = (
    <Animated.View style={[styles.row, animatedStyle]}>
      {columns.map((col) => {
        const value = row[col.key];
        const displayValue = formatCellValue(value);

        return (
          <View
            key={col.key}
            style={[
              styles.cell,
              col.width ? { width: col.width } : { flex: 1 },
            ]}
          >
            <BiolumText
              variant="body"
              size="small"
              color="standard"
              style={{
                textAlign: (col.align ?? "left") as "left" | "center" | "right",
              }}
              numberOfLines={2}
            >
              {displayValue}
            </BiolumText>
          </View>
        );
      })}
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
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.03)",
  },
  cell: {
    paddingHorizontal: 4,
  },
});

export default Grid;
