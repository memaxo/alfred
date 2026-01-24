import { z } from "zod";

export const personaTelemetrySchema = z.object({
  constraints: z.object({
    focusMode: z.boolean(),
    ttsSafe: z.boolean(),
    maxWords: z.number().int().positive().nullable().optional(),
  }),
  heuristicFallbackUsed: z.boolean(),
  intent: z.object({
    type: z.enum(["workflow", "approval", "status_query", "conversational"]),
    confidence: z.number().min(0).max(1).nullable().optional(),
  }),
  speechAct: z.enum([
    "greet",
    "ack",
    "clarify",
    "answer",
    "tooling",
    "recover",
    "close",
  ]),
  tooling: z.object({
    toolsUsed: z.array(z.string()),
    hasToolResults: z.boolean(),
  }),
});

export type PersonaTelemetry = z.infer<typeof personaTelemetrySchema>;

export function parsePersonaTelemetry(
  value: unknown
): { ok: true; value: PersonaTelemetry } | { ok: false; error: string } {
  const parsed = personaTelemetrySchema.safeParse(value);
  if (!parsed.success) {
    return { error: parsed.error.message, ok: false };
  }
  return { ok: true, value: parsed.data };
}
