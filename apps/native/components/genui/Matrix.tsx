import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, MonoText } from "../foundation/BiolumText";

export interface MatrixProps {
  data: (string | number | null)[][];
  rowHeaders?: string[];
  columnHeaders?: string[];
  cellWidth?: number;
  cellHeight?: number;
  onCellPress?: (
    row: number,
    col: number,
    value: string | number | null
  ) => void;
  highlightCell?: { row: number; col: number } | null;
}

export function Matrix({
  data,
  rowHeaders,
  columnHeaders,
  cellWidth = 80,
  cellHeight = 44,
  onCellPress,
  highlightCell,
}: MatrixProps) {
  const theme = useVoidTheme();
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const screenWidth = Dimensions.get("window").width;
  const totalWidth = (rowHeaders ? cellWidth : 0) + data[0]?.length * cellWidth;
  const needsHorizontalScroll = totalWidth > screenWidth - 32;

  const handleCellPress = (row: number, col: number) => {
    const value = data[row]?.[col] ?? null;
    setSelectedCell({ row, col });
    onCellPress?.(row, col, value);
  };

  return (
    <ScrollView
      horizontal={needsHorizontalScroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.container}>
        {/* Column headers */}
        {columnHeaders && (
          <View style={styles.headerRow}>
            {rowHeaders && (
              <View
                style={[styles.cell, { width: cellWidth, height: cellHeight }]}
              />
            )}
            {columnHeaders.map((header, index) => (
              <View
                key={index}
                style={[
                  styles.cell,
                  styles.headerCell,
                  {
                    width: cellWidth,
                    height: cellHeight,
                    backgroundColor: theme.colors.glass.hover,
                  },
                ]}
              >
                <BiolumText
                  variant="caption"
                  size="medium"
                  color="standard"
                  numberOfLines={1}
                >
                  {header}
                </BiolumText>
              </View>
            ))}
          </View>
        )}

        {/* Data rows */}
        {data.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {/* Row header */}
            {rowHeaders && (
              <View
                style={[
                  styles.cell,
                  styles.headerCell,
                  {
                    width: cellWidth,
                    height: cellHeight,
                    backgroundColor: theme.colors.glass.hover,
                  },
                ]}
              >
                <BiolumText
                  variant="caption"
                  size="medium"
                  color="standard"
                  numberOfLines={1}
                >
                  {rowHeaders[rowIndex] ?? ""}
                </BiolumText>
              </View>
            )}

            {/* Data cells */}
            {row.map((cell, colIndex) => {
              const isSelected =
                selectedCell?.row === rowIndex &&
                selectedCell?.col === colIndex;
              const isHighlighted =
                highlightCell?.row === rowIndex &&
                highlightCell?.col === colIndex;

              return (
                <MatrixCell
                  key={colIndex}
                  value={cell}
                  width={cellWidth}
                  height={cellHeight}
                  isSelected={isSelected}
                  isHighlighted={isHighlighted}
                  onPress={() => handleCellPress(rowIndex, colIndex)}
                  theme={theme}
                />
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

interface MatrixCellProps {
  value: string | number | null;
  width: number;
  height: number;
  isSelected: boolean;
  isHighlighted: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useVoidTheme>;
}

function MatrixCell({
  value,
  width,
  height,
  isSelected,
  isHighlighted,
  onPress,
  theme,
}: MatrixCellProps) {
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

  const animatedStyle = useAnimatedStyle(() => {
    let baseOpacity = 0;
    if (isSelected) baseOpacity = 0.15;
    else if (isHighlighted) baseOpacity = 0.1;

    return {
      backgroundColor: `rgba(255, 255, 255, ${baseOpacity + 0.05 * bgOpacity.value})`,
    };
  });

  const displayValue =
    value === null || value === undefined ? "-" : String(value);
  const isNumeric = typeof value === "number";

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.cell,
          {
            width,
            height,
            borderColor: isSelected
              ? theme.colors.biolum.dim
              : theme.colors.glass.border,
            borderWidth: isSelected ? 1 : 0.5,
          },
          animatedStyle,
        ]}
      >
        {isNumeric ? (
          <MonoText size="small" color="standard" numberOfLines={1}>
            {displayValue}
          </MonoText>
        ) : (
          <BiolumText
            variant="body"
            size="small"
            color="standard"
            numberOfLines={1}
          >
            {displayValue}
          </BiolumText>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 4,
  },
  container: {
    borderRadius: 8,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerCell: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
});

export default Matrix;
