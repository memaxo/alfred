/**
 * Notification Router - Notification preferences
 *
 * Provides endpoints for managing notification settings.
 */

import { z } from "zod";
import { authedProcedure, router } from "../trpc";

const notificationPrefsInput = z.object({
  agentCompletions: z.boolean().optional(),
  workflowEvents: z.boolean().optional(),
  systemAlerts: z.boolean().optional(),
  snoozeUntil: z.date().nullable().optional(),
  vacationStart: z.date().nullable().optional(),
  vacationEnd: z.date().nullable().optional(),
});

type NotificationPrefs = {
  agentCompletions: boolean;
  workflowEvents: boolean;
  systemAlerts: boolean;
  snoozeUntil?: Date | null;
  vacationStart?: Date | null;
  vacationEnd?: Date | null;
};

// TODO: Replace with actual DB storage
const mockPrefs: NotificationPrefs = {
  agentCompletions: true,
  workflowEvents: true,
  systemAlerts: true,
};

export const notificationRouter = router({
  // Get notification preferences
  getPreferences: authedProcedure.query(async () => {
    // TODO: Load from DB
    return mockPrefs;
  }),

  // Update notification preferences
  setPreferences: authedProcedure
    .input(notificationPrefsInput)
    .mutation(async ({ input }) => {
      // TODO: Save to DB
      Object.assign(mockPrefs, input);
      return mockPrefs;
    }),
});
