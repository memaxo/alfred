import {
  cancelTimer,
  createTimer,
  getActiveTimers,
  markTimerCompleted,
} from "@alfred/db/repo/assistant";
import { z } from "zod";

import { recordAssistantToolCall } from "../../../src/metrics";

const timerInputSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["start", "active", "done", "cancel"]),
  label: z.string().optional(),
  durationSec: z
    .number()
    .int()
    .min(1)
    .max(24 * 3600)
    .optional(),
  id: z.string().optional(),
});

type TimerInput = z.infer<typeof timerInputSchema>;

function toISOString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function mapTimer(row: Awaited<ReturnType<typeof createTimer>>) {
  if (!row) {
    return null;
  }
  return {
    id: (row as { id: string }).id,
    label: (row as { label?: string | null }).label ?? null,
    durationSec: (row as { duration: number }).duration,
    startAt: toISOString((row as { start?: Date | null }).start ?? null),
    endAt: toISOString((row as { end?: Date | null }).end ?? null),
    cancelled: (row as { cancelled?: boolean | null }).cancelled ?? false,
    completed: (row as { completed?: boolean | null }).completed ?? false,
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

export const toolTimer = {
  name: "timer",
  description: "Manage timers (start, list active, complete, cancel).",
  inputSchema: timerInputSchema,
  outputSchema: z.object({
    ok: z.boolean().optional(),
    timer: z
      .object({
        id: z.string(),
        label: z.string().nullable(),
        durationSec: z.number(),
        startAt: z.string().nullable(),
        endAt: z.string().nullable(),
        cancelled: z.boolean(),
        completed: z.boolean(),
        createdAt: z.string().nullable(),
      })
      .optional(),
    timers: z
      .array(
        z.object({
          id: z.string(),
          label: z.string().nullable(),
          durationSec: z.number(),
          startAt: z.string().nullable(),
          endAt: z.string().nullable(),
          cancelled: z.boolean(),
          completed: z.boolean(),
          createdAt: z.string().nullable(),
        })
      )
      .optional(),
  }),
  execute: async ({ input }: { input: TimerInput }) => {
    recordAssistantToolCall("timer");

    switch (input.action) {
      case "start": {
        const duration = ensure(input.durationSec, "timer_duration_required");
        const created = await createTimer(
          input.userId,
          duration,
          input.label ?? undefined
        );
        return {
          ok: true,
          timer: mapTimer(created),
        };
      }
      case "active": {
        const rows = await getActiveTimers(input.userId);
        return {
          timers: rows
            .map((row) => mapTimer(row))
            .filter(
              (timer): timer is NonNullable<ReturnType<typeof mapTimer>> =>
                timer !== null
            ),
        };
      }
      case "done": {
        const id = ensure(input.id, "timer_id_required");
        const count = await markTimerCompleted(id);
        return {
          ok: count > 0,
        };
      }
      case "cancel": {
        const id = ensure(input.id, "timer_id_required");
        const count = await cancelTimer(id);
        return {
          ok: count > 0,
        };
      }
      default:
        throw new Error("timer_action_not_supported");
    }
  },
};

export type ToolTimer = typeof toolTimer;
