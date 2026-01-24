import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useVoidTheme, useReducedMotion } from "../../hooks/use-void-theme";
import { BiolumText, CaptionText } from "../foundation/BiolumText";
import { HUDSurface } from "../foundation/HUDSurface";

export interface BranchNode {
  id: string;
  label: string;
  preview?: string;
  timestamp?: string;
  children?: BranchNode[];
  isCurrent?: boolean;
}

export interface BranchProps {
  root: BranchNode;
  onSelect: (nodeId: string) => void;
  maxDepth?: number;
}

export function Branch({ root, onSelect, maxDepth = 4 }: BranchProps) {
  const theme = useVoidTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <BranchNodeItem
        node={root}
        depth={0}
        maxDepth={maxDepth}
        onSelect={onSelect}
        theme={theme}
      />
    </ScrollView>
  );
}

interface BranchNodeItemProps {
  node: BranchNode;
  depth: number;
  maxDepth: number;
  onSelect: (nodeId: string) => void;
  theme: ReturnType<typeof useVoidTheme>;
}

function BranchNodeItem({
  node,
  depth,
  maxDepth,
  onSelect,
  theme,
}: BranchNodeItemProps) {
  const reduceMotion = useReducedMotion();
  const hasChildren = node.children && node.children.length > 0;

  if (depth >= maxDepth) return null;

  return (
    <View style={styles.nodeContainer}>
      <Animated.View
        entering={!reduceMotion ? FadeIn.delay(depth * 100) : undefined}
      >
        <Pressable onPress={() => onSelect(node.id)}>
          <HUDSurface
            elevation={node.isCurrent ? 2 : 1}
            active={node.isCurrent}
            style={
              node.isCurrent
                ? [styles.nodeCard, styles.currentNode]
                : styles.nodeCard
            }
          >
            <View style={styles.nodeHeader}>
              <Ionicons
                name={node.isCurrent ? "radio-button-on" : "radio-button-off"}
                size={14}
                color={
                  node.isCurrent
                    ? theme.colors.biolum.full
                    : theme.colors.biolum.faint
                }
              />
              <BiolumText
                variant="body"
                size="small"
                color={node.isCurrent ? "full" : "standard"}
                numberOfLines={1}
              >
                {node.label}
              </BiolumText>
            </View>
            {node.preview && (
              <CaptionText
                size="small"
                color="dim"
                numberOfLines={2}
                style={styles.preview}
              >
                {node.preview}
              </CaptionText>
            )}
            {node.timestamp && (
              <CaptionText size="small" color="faint" style={styles.timestamp}>
                {node.timestamp}
              </CaptionText>
            )}
          </HUDSurface>
        </Pressable>
      </Animated.View>

      {hasChildren && (
        <View style={styles.childrenContainer}>
          {node.children!.map((child, index) => (
            <View key={child.id} style={styles.childRow}>
              <View style={styles.connector}>
                <View
                  style={[
                    styles.connectorHorizontal,
                    { backgroundColor: theme.colors.glass.border },
                  ]}
                />
                {index < node.children!.length - 1 && (
                  <View
                    style={[
                      styles.connectorVertical,
                      { backgroundColor: theme.colors.glass.border },
                    ]}
                  />
                )}
              </View>
              <BranchNodeItem
                node={child}
                depth={depth + 1}
                maxDepth={maxDepth}
                onSelect={onSelect}
                theme={theme}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  nodeContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  nodeCard: {
    width: 160,
    padding: 12,
  },
  currentNode: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
  },
  nodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  preview: {
    marginTop: 6,
  },
  timestamp: {
    marginTop: 4,
  },
  childrenContainer: {
    marginLeft: 16,
    paddingTop: 8,
  },
  childRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  connector: {
    width: 24,
    position: "relative",
  },
  connectorHorizontal: {
    height: 2,
    width: 24,
    position: "absolute",
    top: 20,
    left: 0,
  },
  connectorVertical: {
    width: 2,
    position: "absolute",
    top: 20,
    left: 0,
    bottom: -8,
  },
});

export default Branch;
