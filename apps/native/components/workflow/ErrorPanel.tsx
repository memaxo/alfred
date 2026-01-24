import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, View, Pressable } from "react-native";

import { useVoidTheme } from "../../hooks/use-void-theme";
import { BiolumText, MonoText, CaptionText } from "../foundation/BiolumText";
import { FluidButton } from "../foundation/FluidButton";
import { HUDSurface } from "../foundation/HUDSurface";

export interface ErrorPanelProps {
  title: string;
  message: string;
  stackTrace?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorPanel({
  title,
  message,
  stackTrace,
  onRetry,
  onDismiss,
}: ErrorPanelProps) {
  const theme = useVoidTheme();
  const [stackExpanded, setStackExpanded] = useState(false);

  return (
    <HUDSurface elevation={2} style={styles.container}>
      <View
        style={[
          styles.headerStripe,
          { backgroundColor: theme.colors.semantic.error },
        ]}
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="alert-circle"
              size={24}
              color={theme.colors.semantic.error}
            />
          </View>
          <View style={styles.titleContainer}>
            <BiolumText variant="title" size="small" color="full">
              {title}
            </BiolumText>
          </View>
        </View>

        <CaptionText size="large" color="dim" style={styles.message}>
          {message}
        </CaptionText>

        {stackTrace && (
          <View style={styles.stackContainer}>
            <Pressable
              onPress={() => setStackExpanded(!stackExpanded)}
              style={styles.stackHeader}
            >
              <CaptionText size="small" color="faint">
                Stack trace
              </CaptionText>
              <Ionicons
                name={stackExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={theme.colors.biolum.faint}
              />
            </Pressable>
            {stackExpanded && (
              <View
                style={[
                  styles.stackContent,
                  { backgroundColor: theme.colors.glass.surface },
                ]}
              >
                <MonoText size="small" color="faint" selectable>
                  {stackTrace}
                </MonoText>
              </View>
            )}
          </View>
        )}

        <View style={styles.actions}>
          {onRetry && (
            <FluidButton
              label="Retry"
              variant="primary"
              size="medium"
              onPress={onRetry}
              icon={<Ionicons name="refresh" size={16} color="#ffffff" />}
            />
          )}
          {onDismiss && (
            <FluidButton
              label="Dismiss"
              variant="ghost"
              size="medium"
              onPress={onDismiss}
            />
          )}
        </View>
      </View>
    </HUDSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    overflow: "hidden",
  },
  headerStripe: {
    height: 4,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(200, 145, 145, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
  },
  message: {
    marginTop: 12,
  },
  stackContainer: {
    marginTop: 16,
  },
  stackHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  stackContent: {
    padding: 12,
    borderRadius: 8,
    maxHeight: 200,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
});

export default ErrorPanel;
