/**
 * Notification Router - Notification preferences
 *
 * Provides endpoints for managing notification settings.
 */

import { getPreferences, setPreference } from "@alfred/db/repo/user";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, router } from "../trpc";

const dateInput = z.union([
  z.date(),
  z
    .string()
    .datetime()
    .transform((value) => new Date(value)),
]);

const notificationPrefsInput = z.object({
  agentCompletions: z.boolean().optional(),
  workflowEvents: z.boolean().optional(),
  systemAlerts: z.boolean().optional(),
  snoozeUntil: dateInput.nullable().optional(),
  vacationStart: dateInput.nullable().optional(),
  vacationEnd: dateInput.nullable().optional(),
});

type NotificationPrefs = {
  agentCompletions: boolean;
  workflowEvents: boolean;
  systemAlerts: boolean;
  snoozeUntil: Date | null;
  vacationStart: Date | null;
  vacationEnd: Date | null;
};

const notificationPrefsSchema = z.object({
  agentCompletions: z.boolean(),
  workflowEvents: z.boolean(),
  systemAlerts: z.boolean(),
  snoozeUntil: z.string().datetime().nullable(),
  vacationStart: z.string().datetime().nullable(),
  vacationEnd: z.string().datetime().nullable(),
});

const PREF_KEY = "notification_prefs";

const defaultPrefs: NotificationPrefs = {
  agentCompletions: true,
  workflowEvents: true,
  systemAlerts: true,
  snoozeUntil: null,
  vacationStart: null,
  vacationEnd: null,
};

function toIsoOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}

function fromStored(
  value: z.infer<typeof notificationPrefsSchema>
): NotificationPrefs {
  return {
    agentCompletions: value.agentCompletions,
    workflowEvents: value.workflowEvents,
    systemAlerts: value.systemAlerts,
    snoozeUntil: value.snoozeUntil ? new Date(value.snoozeUntil) : null,
    vacationStart: value.vacationStart ? new Date(value.vacationStart) : null,
    vacationEnd: value.vacationEnd ? new Date(value.vacationEnd) : null,
  };
}

function toStored(
  value: NotificationPrefs
): z.infer<typeof notificationPrefsSchema> {
  return {
    agentCompletions: value.agentCompletions,
    workflowEvents: value.workflowEvents,
    systemAlerts: value.systemAlerts,
    snoozeUntil: toIsoOrNull(value.snoozeUntil),
    vacationStart: toIsoOrNull(value.vacationStart),
    vacationEnd: toIsoOrNull(value.vacationEnd),
  };
}

export const notificationRouter = router({
  // Get notification preferences
  getPreferences: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const prefs = await getPreferences(session.user.id);
    const row = prefs.find((p) => p.key === PREF_KEY) ?? null;
    const parsed = notificationPrefsSchema.safeParse(row?.value);
    return parsed.success ? fromStored(parsed.data) : defaultPrefs;
  }),

  // Update notification preferences
  setPreferences: authedProcedure
    .input(notificationPrefsInput)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const currentList = await getPreferences(session.user.id);
      const currentRow = currentList.find((p) => p.key === PREF_KEY) ?? null;
      const currentParsed = notificationPrefsSchema.safeParse(
        currentRow?.value
      );
      const current = currentParsed.success
        ? fromStored(currentParsed.data)
        : defaultPrefs;

      const merged: NotificationPrefs = {
        agentCompletions: input.agentCompletions ?? current.agentCompletions,
        workflowEvents: input.workflowEvents ?? current.workflowEvents,
        systemAlerts: input.systemAlerts ?? current.systemAlerts,
        snoozeUntil:
          input.snoozeUntil === undefined
            ? current.snoozeUntil
            : input.snoozeUntil,
        vacationStart:
          input.vacationStart === undefined
            ? current.vacationStart
            : input.vacationStart,
        vacationEnd:
          input.vacationEnd === undefined
            ? current.vacationEnd
            : input.vacationEnd,
      };

      await setPreference(
        session.user.id,
        PREF_KEY,
        toStored(merged),
        1.0,
        "user",
        undefined
      );
      return merged;
    }),
});
