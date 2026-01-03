/**
 * Notifications Module
 *
 * Handles local and remote push notifications for reminders and timers.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { trpcClient } from "@/utils/trpc";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
    console.warn("Failed to get push token for push notification!");
    return null;
  }

  try {
    const projectId = process.env.EXPO_PROJECT_ID;
    if (!projectId) {
      console.warn("EXPO_PROJECT_ID not set");
      return null;
    }

    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    // Register token with backend
    try {
      await trpcClient.user.registerPushToken.mutate({
        token,
        platform: Platform.OS as "ios" | "android" | "web",
      });
    } catch (error) {
      console.error("Failed to register push token:", error);
    }
  } catch (error) {
    console.error("Error getting push token:", error);
  }

  return token;
}

export async function scheduleLocalNotification(options: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  trigger: Date | number; // Date for absolute time, number for seconds from now
}): Promise<string> {
  const trigger =
    typeof options.trigger === "number"
      ? { seconds: options.trigger }
      : { date: options.trigger };

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
