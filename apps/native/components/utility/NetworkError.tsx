import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

import { useVoidTheme } from "@/hooks/use-void-theme";

import { BiolumText, CaptionText } from "../foundation/BiolumText";
import { FluidButton } from "../foundation/FluidButton";
import { HUDSurface } from "../foundation/HUDSurface";

interface NetworkErrorProps {
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function NetworkError({
  message = "Unable to connect. Check your internet connection.",
  onRetry,
  isRetrying = false,
}: NetworkErrorProps) {
  const theme = useVoidTheme();

  return (
    <View style={styles.container}>
      <HUDSurface elevation={2} style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={theme.colors.biolum.dim}
          />
        </View>
        <BiolumText color="full" style={styles.title}>
          Connection Error
        </BiolumText>
        <CaptionText style={styles.message}>{message}</CaptionText>
        {onRetry && (
          <FluidButton
            label={isRetrying ? "Retrying..." : "Try Again"}
            variant="secondary"
            onPress={onRetry}
            disabled={isRetrying}
            style={styles.button}
          />
        )}
      </HUDSurface>
    </View>
  );
}

interface QueryErrorProps {
  error: Error | { message: string } | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  compact?: boolean;
}

export function QueryError({
  error,
  onRetry,
  isRetrying = false,
  compact = false,
}: QueryErrorProps) {
  const theme = useVoidTheme();
  const message = error?.message ?? "An error occurred";

  // Determine error type for appropriate messaging
  const isNetworkError =
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("connect") ||
    message.includes("timeout");

  const isAuthError =
    message.includes("unauthorized") ||
    message.includes("401") ||
    message.includes("session");

  const getErrorIcon = () => {
    if (isNetworkError) {
      return "cloud-offline-outline";
    }
    if (isAuthError) {
      return "lock-closed-outline";
    }
    return "alert-circle-outline";
  };

  const getErrorTitle = () => {
    if (isNetworkError) {
      return "Connection Error";
    }
    if (isAuthError) {
      return "Session Expired";
    }
    return "Something Went Wrong";
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactRow}>
          <Ionicons
            name={getErrorIcon()}
            size={16}
            color={theme.colors.semantic.error}
          />
          <CaptionText style={styles.compactMessage} numberOfLines={1}>
            {message}
          </CaptionText>
          {onRetry && (
            <FluidButton
              label="Retry"
              variant="ghost"
              size="small"
              onPress={onRetry}
              disabled={isRetrying}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HUDSurface elevation={2} style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={getErrorIcon()}
            size={40}
            color={theme.colors.semantic.error}
          />
        </View>
        <BiolumText color="full" style={styles.title}>
          {getErrorTitle()}
        </BiolumText>
        <CaptionText style={styles.message}>{message}</CaptionText>
        {onRetry && (
          <FluidButton
            label={isRetrying ? "Retrying..." : "Try Again"}
            variant="secondary"
            onPress={onRetry}
            disabled={isRetrying}
            style={styles.button}
          />
        )}
      </HUDSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    padding: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    minWidth: 120,
  },
  compactContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compactMessage: {
    flex: 1,
  },
});
