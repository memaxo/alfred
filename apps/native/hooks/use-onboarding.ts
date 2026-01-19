/**
 * Onboarding Hook
 *
 * Manages onboarding state and completion.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { NativeModules, Platform } from "react-native";

const ONBOARDING_KEY = "alfred.onboarding.completed";

export function useOnboarding() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const uiTestMode = (() => {
      if (process.env.EXPO_PUBLIC_TEST_MODE === "1") {
        return true;
      }
      if (Platform.OS !== "ios") {
        return false;
      }
      const settings = (
        NativeModules as unknown as { SettingsManager?: unknown }
      ).SettingsManager as { settings?: Record<string, unknown> } | undefined;
      const raw = settings?.settings?.ALFRED_TEST_MODE;
      return raw === "1" || raw === "true";
    })();

    if (uiTestMode) {
      setHasCompletedOnboarding(true);
      setIsLoading(false);
      return;
    }

    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasCompletedOnboarding(completed === "true");
      } catch (_error) {
        setHasCompletedOnboarding(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboarding();
  }, []);

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      setHasCompletedOnboarding(true);
    } catch (_error) {}
  };

  return {
    hasCompletedOnboarding,
    isLoading,
    completeOnboarding,
  };
}
