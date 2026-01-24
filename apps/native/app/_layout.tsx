import "@/polyfills";
import {
  DarkTheme,
  DefaultTheme,
  type Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import "../global.css";
import React, { useEffect, useRef } from "react";
import { InteractionManager, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import type { TRPCAppRouter } from "@/utils/trpc";

import { ErrorBoundary } from "@/components/error-boundary";
import { ScreenErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/offline-banner";
import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { SheetProvider } from "@/contexts/sheet";
import { ToastProvider } from "@/contexts/toast";
import { useDeepLinkHandler } from "@/hooks/use-deep-link";
import { useOnboarding } from "@/hooks/use-onboarding";
import { analytics } from "@/lib/analytics";
import { setAndroidNavigationBar } from "@/lib/android-navigation-bar";
import { ApiProvider, useAuthClient, useTrpcClient } from "@/lib/api";
import { NAV_THEME } from "@/lib/constants";
import { initializeDatabase } from "@/lib/db";
import {
  registerForPushNotificationsWithClient,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from "@/lib/notifications";
import {
  handleNotificationReceived,
  handleNotificationResponse,
} from "@/lib/notifications/handlers";
import { syncEngine } from "@/lib/sync";
import { useColorScheme } from "@/lib/use-color-scheme";
import {
  checkForUpdates,
  fetchUpdate,
  promptUpdate,
  reloadApp,
} from "@/lib/version-check";
import { queryClient } from "@/utils/trpc";

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
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ApiProvider>
          <RootLayoutInner />
        </ApiProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function RootLayoutInner() {
  const hasMounted = useRef(false);
  const _router = useRouter();
  const { colorScheme, isDarkColorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);
  const {
    hasCompletedOnboarding,
    isLoading: onboardingLoading,
    completeOnboarding,
  } = useOnboarding();
  const authClient = useAuthClient();
  const trpcClient = useTrpcClient<TRPCAppRouter>();
  const { data: session } = authClient.useSession();
  const testNavRef = useRef(false);

  // Handle deep links
  useDeepLinkHandler();

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

  // Initialize local database and sync engine (deferred until after first render)
  React.useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        await initializeDatabase();
        if (trpcClient) {
          await syncEngine.initialize(trpcClient);
        }
      } catch (error) {
        console.error("Failed to initialize database:", error);
      }
    });
    return () => task.cancel();
  }, [trpcClient]);

  // Register for push notifications and set up handlers
  React.useEffect(() => {
    if (!session?.user) {
      return;
    }
    registerForPushNotificationsWithClient(trpcClient).catch((_error) => {});

    // Set up notification listeners
    const receivedSub = addNotificationReceivedListener(
      handleNotificationReceived
    );
    const responseSub = addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [session?.user, trpcClient]);

  // Deterministic UI-test route: start in Call screen when enabled.
  useEffect(() => {
    const uiTestMode = (() => {
      if (process.env.EXPO_PUBLIC_TEST_MODE === "1") {
        return true;
      }
      if (Platform.OS !== "ios") {
        return false;
      }
      // XCUITest can pass `-ALFRED_TEST_MODE 1` as a launch argument,
      // which iOS exposes via NSUserDefaults.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NativeModules } = require("react-native") as {
          NativeModules?: {
            SettingsManager?: { settings?: Record<string, unknown> };
          };
        };
        const raw = NativeModules?.SettingsManager?.settings?.ALFRED_TEST_MODE;
        return raw === "1" || raw === "true";
      } catch {
        return false;
      }
    })();

    if (!uiTestMode) {
      return;
    }
    if (!session?.user?.id) {
      return;
    }
    if (testNavRef.current) {
      return;
    }
    testNavRef.current = true;
    _router.replace("/(drawer)/call");
  }, [session?.user?.id, _router]);

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
      const timeoutId = setTimeout(() => {
        void checkUpdates().catch(() => {
          // ignore
        });
      }, 3000);

      return () => {
        clearTimeout(timeoutId);
      };
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

  return (
    <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
      <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ToastProvider>
          <SheetProvider>
            <ScreenErrorBoundary>
              <OfflineBanner />
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
            </ScreenErrorBoundary>
          </SheetProvider>
        </ToastProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const useIsomorphicLayoutEffect =
  Platform.OS === "web" && typeof window === "undefined"
    ? React.useEffect
    : React.useLayoutEffect;
