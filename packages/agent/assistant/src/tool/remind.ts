import {
  createReminder,
  deleteReminder,
  getDueReminders,
  getReminders,
  markReminderFired,
} from "@alfred/db/repo/assistant";
import { z } from "zod";

import { recordAssistantToolCall } from "../../../src/metrics";

const reminderInputSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["create", "list", "due", "complete", "delete"]),
  id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  due: z.string().optional(),
  before: z.string().optional(),
  recurring: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

type ReminderInput = z.infer<typeof reminderInputSchema>;

function toISOString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function mapReminder(row: Awaited<ReturnType<typeof createReminder>>) {
  if (!row) {
    return null;
  }
  return {
    id: (row as { id: string }).id,
    title: (row as { title: string }).title,
    description: (row as { description?: string | null }).description ?? null,
    dueAt: toISOString((row as { due: Date }).due),
    fired: (row as { fired?: boolean | null }).fired ?? false,
    firedAt: toISOString((row as { firedAt?: Date | null }).firedAt ?? null),
    recurring: (row as { recurring?: string | null }).recurring ?? null,
    createdAt: toISOString((row as { created?: Date | null }).created ?? null),
  };
}

function ensure<T>(value: T | undefined | null, error: string): T {
  if (value === undefined || value === null) {
    throw new Error(error);
  }
  if (typeof value === "string" && value.trim().length === 0) {
    throw new Error(error);
  }
  return value;
}

export const toolRemind = {
  name: "remind",
  description: "Manage reminders (create, list, due, complete, delete).",
  inputSchema: reminderInputSchema,
  outputSchema: z.object({
    ok: z.boolean().optional(),
    reminder: z
      .object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        dueAt: z.string().nullable(),
        fired: z.boolean(),
        firedAt: z.string().nullable(),
        recurring: z.string().nullable(),
        createdAt: z.string().nullable(),
      })
      .optional(),
    reminders: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().nullable(),
          dueAt: z.string().nullable(),
          fired: z.boolean(),
          firedAt: z.string().nullable(),
          recurring: z.string().nullable(),
          createdAt: z.string().nullable(),
        })
      )
      .optional(),
  }),
  execute: async ({ input }: { input: ReminderInput }) => {
    recordAssistantToolCall("remind");

    switch (input.action) {
      case "create": {
        const title = ensure(input.title, "reminder_title_required");
        const dueIso = ensure(input.due, "reminder_due_required");
        const due = new Date(dueIso);
        if (Number.isNaN(due.getTime())) {
          throw new Error("reminder_due_invalid");
        }
        const created = await createReminder(
          input.userId,
          title,
          due,
          input.description ?? undefined,
          input.recurring ?? undefined
        );
        return {
          ok: true,
          reminder: mapReminder(created),
        };
      }
      case "list": {
        const limit = input.limit ?? 50;
        const offset = input.offset ?? 0;
        const rows = await getReminders(input.userId, limit, offset);
        return {
          reminders: rows
            .map((row) => mapReminder(row))
            .filter(
              (
                reminder
              ): reminder is NonNullable<ReturnType<typeof mapReminder>> =>
                reminder !== null
            ),
        };
      }
      case "due": {
        const beforeIso = ensure(input.before, "reminder_before_required");
        const before = new Date(beforeIso);
        if (Number.isNaN(before.getTime())) {
          throw new Error("reminder_before_invalid");
        }
        const rows = await getDueReminders(input.userId, before);
        return {
          reminders: rows
            .map((row) => mapReminder(row))
            .filter(
              (
                reminder
              ): reminder is NonNullable<ReturnType<typeof mapReminder>> =>
                reminder !== null
            ),
        };
      }
      case "complete": {
        const id = ensure(input.id, "reminder_id_required");
        const count = await markReminderFired(id);
        return {
          ok: count > 0,
        };
      }
      case "delete": {
        const id = ensure(input.id, "reminder_id_required");
        const count = await deleteReminder(id);
        return {
          ok: count > 0,
        };
      }
      default:
        throw new Error("reminder_action_not_supported");
    }
  },
};

export type ToolRemind = typeof toolRemind;
