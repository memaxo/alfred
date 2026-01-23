import { z } from "zod";

export const personaTelemetrySchema = z.object({
  speechAct: z.enum([
    "greet",
    "ack",
    "clarify",
    "answer",
    "tooling",
    "recover",
    "close",
  ]),
  constraints: z.object({
    focusMode: z.boolean(),
    ttsSafe: z.boolean(),
    maxWords: z.number().int().positive().nullable().optional(),
  }),
  tooling: z.object({
    toolsUsed: z.array(z.string()),
    hasToolResults: z.boolean(),
  }),
  heuristicFallbackUsed: z.boolean(),
  intent: z.object({
    type: z.enum(["workflow", "approval", "status_query", "conversational"]),
    confidence: z.number().min(0).max(1).nullable().optional(),
  }),
});

export type PersonaTelemetry = z.infer<typeof personaTelemetrySchema>;

export function parsePersonaTelemetry(value: unknown):
  | { ok: true; value: PersonaTelemetry }
  | { ok: false; error: string } {
  const parsed = personaTelemetrySchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  return { ok: true, value: parsed.data };
}

