/**
 * Timer Notifications Hook
 *
 * Handles scheduling completion notifications for timers.
 */

import { useEffect, useRef } from "react";
import {
  cancelNotification,
  scheduleLocalNotification,
} from "@/lib/notifications";
import type { TimerRouterOutputs } from "@/utils/trpc-types";

/**
 * Hook to manage completion notifications for active timers
 */
export function useTimerNotifications(timers: TimerRouterOutputs["active"]) {
  const notificationIdsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!timers || timers.length === 0) {
      // Cancel all notifications if no active timers
      notificationIdsRef.current.forEach((id) => {
        cancelNotification(id).catch(console.error);
      });
      notificationIdsRef.current.clear();
      return;
    }

    const scheduleNotifications = async () => {
      for (const timer of timers) {
        try {
          const endTime = new Date(timer.endTime);
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
          console.error(
            `Failed to schedule notification for timer ${timer.id}:`,
            error
          );
        }
      }

      // Cancel notifications for timers that are no longer active
      const activeTimerIds = new Set(timers.map((t) => t.id));
      for (const [
        timerId,
        notificationId,
      ] of notificationIdsRef.current.entries()) {
        if (!activeTimerIds.has(timerId)) {
          await cancelNotification(notificationId).catch(console.error);
          notificationIdsRef.current.delete(timerId);
        }
      }
    };

    scheduleNotifications();

    // Cleanup on unmount
    return () => {
      notificationIdsRef.current.forEach((id) => {
        cancelNotification(id).catch(console.error);
      });
      notificationIdsRef.current.clear();
    };
  }, [timers]);

  return {
    cancelAllNotifications: async () => {
      for (const id of notificationIdsRef.current.values()) {
        await cancelNotification(id).catch(console.error);
      }
      notificationIdsRef.current.clear();
    },
  };
}
