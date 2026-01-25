/**
 * Notifications Module
 *
 * Handles local and remote push notifications for reminders and timers.
 */

import type { TRPCClient } from "@trpc/client";

import { logger } from "@alfred/logger";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { TRPCAppRouter } from "@/utils/trpc";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getExpoProjectId(): string | null {
  const easId = Constants.easConfig?.projectId;
  if (
    typeof easId === "string" &&
    easId.length > 0 &&
    easId !== "your-project-id-here"
  ) {
    return easId;
  }

  const extraId = (
    Constants.expoConfig?.extra as Record<string, unknown> | null
  )?.eas;
  if (
    extraId &&
    typeof extraId === "object" &&
    "projectId" in extraId &&
    typeof (extraId as { projectId?: unknown }).projectId === "string"
  ) {
    const { projectId } = extraId as { projectId: string };
    if (projectId !== "your-project-id-here") {
      return projectId;
    }
  }

  const envId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (
    typeof envId === "string" &&
    envId.length > 0 &&
    envId !== "your-project-id-here"
  ) {
    return envId;
  }

  return null;
}

export async function registerForPushNotificationsWithClient(
  trpcClient?: TRPCClient<TRPCAppRouter> | null
): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00D9FF",
      });
    } catch (error) {
      logger.warn("Failed to set notification channel", { error });
    }
  }

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      logger.warn("Push notification permissions not granted");
      return null;
    }
  } catch (error) {
    logger.warn("Failed to get notification permissions", { error });
    return null;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    // Silently skip push notification registration in development if project ID is missing
    if (__DEV__) {
      logger.debug(
        "Skipping push notification registration: EAS project ID not configured"
      );
    } else {
      logger.warn(
        "Skipping push notification registration: EAS project ID not configured"
      );
    }
    return null;
  }

  try {
    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    if (token && trpcClient) {
      try {
        await trpcClient.user.registerPushToken.mutate({
          token,
          platform: Platform.OS as "ios" | "android" | "web",
        });
      } catch (error) {
        // Log but don't fail - token was obtained successfully
        logger.warn("Failed to register push token with backend", { error });
      }
    }
  } catch (error) {
    // Handle keychain and other errors gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("Keychain") ||
      errorMessage.includes("entitlement")
    ) {
      logger.warn(
        "Push notification registration skipped: keychain access not available (development mode)",
        {
          error: errorMessage,
        }
      );
    } else {
      logger.error("Error getting push token", { error });
    }
  }

  return token;
}

/**
 * Back-compat wrapper for callers that don't have a tRPC client handy yet.
 * This still registers for push notifications and returns the Expo push token,
 * but will skip backend registration.
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  const token = await registerForPushNotificationsWithClient(null).catch(
    (error) => {
      logger.warn("Push notification registration failed", { error });
      return null;
    }
  );
  return token;
}

export async function scheduleLocalNotification(options: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  trigger: Date | number; // Date for absolute time, number for seconds from now
}): Promise<string> {
  const trigger: Notifications.NotificationTriggerInput =
    typeof options.trigger === "number"
      ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: options.trigger,
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: options.trigger,
        };

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: options.title,
      body: options.body,
      data: options.data,
      sound: true,
    },
    trigger,
  });

  return notificationId;
}

export async function cancelNotification(
  notificationId: string
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Listen for notification events
export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseReceivedListener(
  listener: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(listener);
}
