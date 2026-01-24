/**
 * Timer Notifications Hook
 *
 * Handles scheduling completion notifications for timers.
 */

import { logger } from "@alfred/logger";
import { useEffect, useRef } from "react";

import type { TimerRouterOutputs } from "@/utils/trpc-types";

import {
  cancelNotification,
  scheduleLocalNotification,
} from "@/lib/notifications";

/**
 * Hook to manage completion notifications for active timers
 */
export function useTimerNotifications(timers: TimerRouterOutputs["active"]) {
  const notificationIdsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!timers || timers.length === 0) {
      // Cancel all notifications if no active timers
      notificationIdsRef.current.forEach((id) => {
        cancelNotification(id).catch((error) =>
          logger.error("Failed to cancel notification", {
            error,
            notificationId: id,
          })
        );
      });
      notificationIdsRef.current.clear();
      return;
    }

    const scheduleNotifications = async () => {
      for (const timer of timers) {
        try {
          const endTime = new Date(timer.end);
          const now = new Date();
          const secondsUntilEnd = Math.max(
            0,
            Math.floor((endTime.getTime() - now.getTime()) / 1000)
          );

          // Cancel existing notification for this timer if any
          const existingId = notificationIdsRef.current.get(timer.id);
          if (existingId) {
            await cancelNotification(existingId);
          }

          // Only schedule if timer hasn't ended
          if (secondsUntilEnd > 0) {
            const notificationId = await scheduleLocalNotification({
              title: timer.label || "Timer Complete",
              body: "Your timer has finished",
              data: {
                timerId: timer.id,
                type: "timer",
              },
              trigger: secondsUntilEnd,
            });

            notificationIdsRef.current.set(timer.id, notificationId);
          }
        } catch (error) {
          logger.error("Failed to schedule notification for timer", {
            error,
            timerId: timer.id,
          });
        }
      }

      // Cancel notifications for timers that are no longer active
      const activeTimerIds = new Set(timers.map((t: { id: string }) => t.id));
      for (const [
        timerId,
        notificationId,
      ] of notificationIdsRef.current.entries()) {
        if (!activeTimerIds.has(timerId)) {
          await cancelNotification(notificationId).catch((error) =>
            logger.error("Failed to cancel notification for inactive timer", {
              error,
              timerId,
              notificationId,
            })
          );
          notificationIdsRef.current.delete(timerId);
        }
      }
    };

    scheduleNotifications();

    // Cleanup on unmount
    return () => {
      notificationIdsRef.current.forEach((id) => {
        cancelNotification(id).catch((error) =>
          logger.error("Failed to cancel notification on unmount", {
            error,
            notificationId: id,
          })
        );
      });
      notificationIdsRef.current.clear();
    };
  }, [timers]);

  return {
    cancelAllNotifications: async () => {
      for (const id of notificationIdsRef.current.values()) {
        await cancelNotification(id).catch((error) =>
          logger.error(
            "Failed to cancel notification in cancelAllNotifications",
            { error, notificationId: id }
          )
        );
      }
      notificationIdsRef.current.clear();
    },
  };
}
