import type * as Notifications from "expo-notifications";

import { logger } from "@alfred/logger";
import * as Linking from "expo-linking";

export type NotificationType =
  | "reminder.due"
  | "timer.complete"
  | "agent.response"
  | "workflow.complete"
  | "note.shared"
  | "default";

interface NotificationData {
  type?: NotificationType;
  reminderId?: string;
  timerId?: string;
  conversationId?: string;
  runId?: string;
  noteId?: string;
  [key: string]: unknown;
}

const NOTIFICATION_ROUTES: Record<
  NotificationType,
  (data: NotificationData) => string
> = {
  "reminder.due": (data) =>
    `alfred://library/reminder/${data.reminderId ?? ""}`,
  "timer.complete": () => "alfred://library/timers",
  "agent.response": (data) => `alfred://chat/${data.conversationId ?? ""}`,
  "workflow.complete": (data) => `alfred://workflow/${data.runId ?? ""}`,
  "note.shared": (data) => `alfred://library/note/${data.noteId ?? ""}`,
  default: () => "alfred://",
};

export function getDeepLinkForNotification(data: NotificationData): string {
  const type = (data.type as NotificationType) ?? "default";
  const routeBuilder = NOTIFICATION_ROUTES[type] ?? NOTIFICATION_ROUTES.default;
  return routeBuilder(data);
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<void> {
  const data = response.notification.request.content.data as NotificationData;

  logger.info("notification_tapped", {
    type: data.type,
    actionIdentifier: response.actionIdentifier,
  });

  // Default action is to open the app to the relevant screen
  if (
    response.actionIdentifier === "expo.modules.notifications.actions.DEFAULT"
  ) {
    const deepLink = getDeepLinkForNotification(data);

    try {
      const canOpen = await Linking.canOpenURL(deepLink);
      if (canOpen) {
        await Linking.openURL(deepLink);
      } else {
        logger.warn("cannot_open_deep_link", { deepLink });
      }
    } catch (error) {
      logger.error("deep_link_error", { deepLink, error });
    }
  }
}

export function handleNotificationReceived(
  notification: Notifications.Notification
): void {
  const data = notification.request.content.data as NotificationData;

  logger.info("notification_received", {
    type: data.type,
    title: notification.request.content.title,
  });

  // Could add logic here to update local state, show in-app notification, etc.
}
