import {
  type FocusState,
  startFocus,
  statusFocus,
  stopFocus,
  updateFocus,
} from "@alfred/cognitive/state";
import { assistantRepo, userRepo } from "@alfred/db";
import { z } from "zod";
import { recordAssistantToolCall } from "../../../src/metrics";

const focusInputSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["start", "stop", "status", "set"]),
  durationMin: z
    .number()
    .int()
    .positive()
    .max(12 * 60)
    .optional(),
  note: z.string().max(280).optional(),
});

const focusHintSchema = z.object({
  nextBreak: z.string().optional(),
  suggestedTasks: z.array(z.string()).optional(),
});

const focusOutputSchema = z.object({
  ok: z.boolean().optional(),
  status: z.enum(["active", "idle"]),
  since: z.string().nullable().optional(),
  durationMin: z.number().int().positive().optional(),
  note: z.string().nullable().optional(),
  hints: focusHintSchema.optional(),
});

type FocusInput = z.infer<typeof focusInputSchema>;
type FocusPreferenceRow = {
  key: string;
  value: unknown;
} | null;

function parseFocusState(entry: FocusPreferenceRow): FocusState | null {
  if (!entry) {
    return null;
  }
  const value = entry.value;
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as {
    _: string;
    since?: string | null;
    duration?: number | null;
    note?: string | null;
    metrics?: unknown;
  };
  if (candidate._ !== "active" && candidate._ !== "idle") {
    return null;
  }
  return {
    _: candidate._,
    since: candidate.since ?? undefined,
    duration:
      typeof candidate.duration === "number" ? candidate.duration : undefined,
    note: typeof candidate.note === "string" ? candidate.note : undefined,
    sessions:
      typeof (candidate as { sessions?: number }).sessions === "number"
        ? (candidate as { sessions?: number }).sessions
        : undefined,
    last: (candidate as { last?: FocusState["last"] }).last,
  };
}

function toOutput(state: FocusState, hints?: z.infer<typeof focusHintSchema>) {
  return focusOutputSchema.parse({
    status: state._,
    since: state.since ?? null,
    durationMin: state.duration,
    note: state.note ?? null,
    hints,
  });
}

function computeNextBreak(state: FocusState) {
  if (state._ !== "active" || !state.since || !state.duration) {
    return;
  }
  const since = Date.parse(state.since);
  if (!Number.isFinite(since)) {
    return;
  }
  const next = new Date(since + state.duration * 60_000);
  return next.toISOString();
}

async function computeSuggestedTasks(userId: string) {
  try {
    const tasks = await assistantRepo.getTasks(userId, "pending", 3);
    return tasks
      .map((task) =>
        typeof task.title === "string" && task.title.length > 0
          ? task.title
          : (task.description ?? null)
      )
      .filter((title): title is string => Boolean(title))
      .slice(0, 3);
  } catch {
    return;
  }
}

async function loadFocusPreference(userId: string) {
  const preferences = (await userRepo.getPreferences(
    userId
  )) as unknown as Array<{ key: string; value: unknown }>;
  const entry = preferences.find((pref) => pref.key === "focus") ?? null;
  return parseFocusState(entry);
}

async function persistFocus(userId: string, state: FocusState) {
  await userRepo.setPreference(userId, "focus", state, 1.0, "assistant");
}

export const toolFocus = {
  name: "focus",
  description:
    "Toggle focus mode, adjust parameters, and inspect the current focus state.",
  inputSchema: focusInputSchema,
  outputSchema: focusOutputSchema,
  execute: async ({ input }: { input: FocusInput }) => {
    recordAssistantToolCall("focus");

    const now = new Date();
    const current = await loadFocusPreference(input.userId);

    let updated: FocusState;
    let ok = false;

    switch (input.action) {
      case "start": {
        updated = startFocus(current, {
          durationMin: input.durationMin,
          note: input.note,
          since: now.toISOString(),
        });
        ok = updated._ === "active";
        break;
      }
      case "stop": {
        updated = stopFocus(current);
        ok = true;
        break;
      }
      case "set": {
        if (current) {
          updated = updateFocus(current, {
            durationMin: input.durationMin,
            note: input.note,
            timestamp: now.toISOString(),
          });
        } else {
          updated = startFocus(
            { _: "idle" },
            {
              durationMin: input.durationMin,
              note: input.note,
              since: now.toISOString(),
            }
          );
        }
        ok = true;
        break;
      }
      case "status":
      default: {
        updated = statusFocus(current);
        break;
      }
    }

    if (input.action !== "status") {
      await persistFocus(input.userId, updated);
      await userRepo.addEvent(input.userId, "tool_use", {
        tool: "focus",
        action: input.action,
        durationMin: input.durationMin,
        note: input.note,
      });
    }

    const suggestedTasks = await computeSuggestedTasks(input.userId);
    const hints =
      suggestedTasks || updated._ === "active"
        ? {
            nextBreak: computeNextBreak(updated),
            suggestedTasks:
              suggestedTasks && suggestedTasks.length > 0
                ? suggestedTasks
                : undefined,
          }
        : undefined;

    return {
      ...(ok ? { ok } : {}),
      ...toOutput(updated, hints),
    };
  },
};

export type ToolFocus = typeof toolFocus;
