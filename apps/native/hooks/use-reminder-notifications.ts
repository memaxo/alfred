/**
 * Reminder Notifications Hook
 *
 * Handles scheduling and canceling notifications for reminders.
 */

import { logger } from "@alfred/logger";
import { useEffect, useRef } from "react";

import type { RemindRouterOutputs } from "@/utils/trpc-types";

import {
  cancelNotification,
  scheduleLocalNotification,
} from "@/lib/notifications";

/**
 * Hook to manage notifications for a reminder
 */
export function useReminderNotifications(
  reminder: RemindRouterOutputs["create"] | null
) {
  const notificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!reminder || reminder.fired) {
      // Cancel notification if reminder is fired
      if (notificationIdRef.current) {
        cancelNotification(notificationIdRef.current);
        notificationIdRef.current = null;
      }
      return;
    }

    const scheduleNotification = async () => {
      try {
        const dueDate = reminder.due
          ? new Date(reminder.due)
          : new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 24h from now

        // Cancel existing notification if any
        if (notificationIdRef.current) {
          await cancelNotification(notificationIdRef.current);
        }

        // Schedule new notification
        const notificationId = await scheduleLocalNotification({
          title: reminder.title,
          body: reminder.description || "Reminder",
          data: {
            reminderId: reminder.id,
            type: "reminder",
          },
          trigger: dueDate,
        });

        notificationIdRef.current = notificationId;
      } catch (_error) {}
    };

    scheduleNotification();

    // Cleanup on unmount
    return () => {
      if (notificationIdRef.current) {
        cancelNotification(notificationIdRef.current).catch((error) =>
          logger.error("Failed to cancel reminder notification on unmount", {
            error,
            notificationId: notificationIdRef.current,
          })
        );
      }
    };
  }, [reminder]);

  return {
    cancelNotification: async () => {
      if (notificationIdRef.current) {
        await cancelNotification(notificationIdRef.current);
        notificationIdRef.current = null;
      }
    },
  };
}
