/**
 * Notifications Module
 *
 * Handles local and remote push notifications for reminders and timers.
 */

import { logger } from "@alfred/logger";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { trpcClient } from "@/utils/trpc";

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
  if (typeof easId === "string" && easId.length > 0) {
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
    return (extraId as { projectId: string }).projectId;
  }

  const envId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (typeof envId === "string" && envId.length > 0) {
    return envId;
  }

  return null;
}

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  let token: string | null = null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#00D9FF",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    logger.warn("Failed to get push token for push notification!");
    return null;
  }

  try {
    const projectId = getExpoProjectId();
    if (!projectId) {
      logger.warn("expo_project_id_missing");
      return null;
    }

    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    await trpcClient.user.registerPushToken.mutate({
      token,
      platform: Platform.OS as "ios" | "android" | "web",
    });
  } catch (error) {
    logger.error("Error getting push token", { error });
  }

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
