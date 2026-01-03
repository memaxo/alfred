import "@/polyfills";
import {
  DarkTheme,
  DefaultTheme,
  type Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { useOnboarding } from "@/hooks/use-onboarding";
import { analytics } from "@/lib/analytics";
import { setAndroidNavigationBar } from "@/lib/android-navigation-bar";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { useColorScheme } from "@/lib/use-color-scheme";
import {
  checkForUpdates,
  fetchUpdate,
  promptUpdate,
  reloadApp,
} from "@/lib/version-check";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
};
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
};

export const unstable_settings = {
  initialRouteName: "(drawer)",
};

export default function RootLayout() {
  const hasMounted = useRef(false);
  const router = useRouter();
  const { colorScheme, isDarkColorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);
  const {
    hasCompletedOnboarding,
    isLoading: onboardingLoading,
    completeOnboarding,
  } = useOnboarding();
  const { data: session } = authClient.useSession();

  // Initialize analytics when user is logged in
  useEffect(() => {
    if (session?.user?.id) {
      analytics.initialize(session.user.id, {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      });
    } else {
      analytics.reset();
    }
  }, [session?.user?.id]);

  // Register for push notifications on mount
  React.useEffect(() => {
    registerForPushNotificationsAsync().catch((error) => {
      console.error("Failed to register for push notifications:", error);
    });
  }, []);

  // Check for app updates on mount
  React.useEffect(() => {
    const checkUpdates = async () => {
      const hasUpdate = await checkForUpdates();
      if (hasUpdate) {
        const fetched = await fetchUpdate();
        if (fetched) {
          promptUpdate(
            async () => {
              await reloadApp();
            },
            () => {
              // User chose to update later
            }
          );
        }
      }
    };

    // Only check in production, and delay slightly to not interrupt initial load
    if (!__DEV__) {
      setTimeout(checkUpdates, 3000);
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return;
    }

    if (Platform.OS === "web") {
      document.documentElement.classList.add("bg-background");
    }
    setAndroidNavigationBar(colorScheme);
    setIsColorSchemeLoaded(true);
    hasMounted.current = true;
  }, []);

  if (!isColorSchemeLoaded || onboardingLoading) {
    return null;
  }

  // Show onboarding if not completed
  if (hasCompletedOnboarding === false) {
    return (
      <OnboardingScreen
        onComplete={async () => {
          await completeOnboarding();
        }}
      />
    );
  }

  // Extract tRPC provider to avoid JSX syntax issues with type assertion
  const TrpcProvider = (trpc as any).Provider;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TrpcProvider client={trpcClient} queryClient={queryClient}>
          <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
            <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
            <OfflineBanner />
            <GestureHandlerRootView style={{ flex: 1 }}>
              <Stack>
                <Stack.Screen
                  name="(drawer)"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="modal"
                  options={{ title: "Modal", presentation: "modal" }}
                />
              </Stack>
            </GestureHandlerRootView>
          </ThemeProvider>
        </TrpcProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const useIsomorphicLayoutEffect =
  Platform.OS === "web" && typeof window === "undefined"
    ? React.useEffect
    : React.useLayoutEffect;
