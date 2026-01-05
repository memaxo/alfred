/**
 * Version Check Utilities
 *
 * Checks for app updates and prompts users to update.
 */

import * as Updates from "expo-updates";
import { Alert } from "react-native";

export async function checkForUpdates(): Promise<boolean> {
  try {
    if (__DEV__) {
      // Skip update checks in development
      return false;
    }

    const update = await Updates.checkForUpdateAsync();
    return update.isAvailable;
  } catch (_error) {
    return false;
  }
}

export async function fetchUpdate(): Promise<boolean> {
  try {
    if (__DEV__) {
      return false;
    }

    const result = await Updates.fetchUpdateAsync();
    return result.isNew;
  } catch (_error) {
    return false;
  }
}

export async function reloadApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch (_error) {}
}

export function promptUpdate(
  onUpdate: () => void,
  onCancel?: () => void
): void {
  Alert.alert(
    "Update Available",
    "A new version of Alfred is available. Would you like to update now?",
    [
      {
        text: "Later",
        style: "cancel",
        onPress: onCancel,
      },
      {
        text: "Update",
        onPress: onUpdate,
      },
    ]
  );
}

export function getAppVersion(): string {
  return Updates.updateId || "1.0.0";
}

export function getRuntimeVersion(): string | null {
  return Updates.runtimeVersion ?? null;
}
