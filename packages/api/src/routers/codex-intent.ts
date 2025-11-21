import type { AlfredCodexEvent } from "@alfred/agent/orchestrator/tool/codex";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

/**
 * Intent-based Codex API for mobile/simplified clients
 * Translates high-level intents into structured Codex prompts
 */

const codexIntentInputSchema = z.object({
  intent: z.string().min(1).max(500),
  auto: z.enum(["read", "low", "medium", "high"]).default("high"),
  authz: z.string().optional(),
  sessionId: z.string().min(1).max(255).optional(),
  cw: z.string().optional(),
  context: z
    .object({
      linearIssueId: z.string().optional(),
      linearSessionId: z.string().optional(),
      linearSpace: z.string().optional(),
      linearAuthz: z.string().optional(),
      relevantFiles: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * Map high-level intents to structured Codex prompts
 * Examples:
 * - "fix bug in auth" -> "Analyze and fix authentication bugs in this repository"
 * - "add tests" -> "Add comprehensive test coverage for untested modules"
 * - "refactor module X" -> "Refactor module X following best practices"
 */
function intentToPrompt(intent: string): string {
  const lower = intent.toLowerCase().trim();

  // Common patterns
  if (lower.startsWith("fix")) {
    return `Analyze and ${intent}. Provide detailed reasoning and ensure the fix is safe.`;
  }
  if (lower.startsWith("add") || lower.startsWith("create")) {
    return `${intent}. Follow best practices and ensure quality.`;
  }
  if (lower.startsWith("refactor")) {
    return `${intent}. Maintain existing functionality and improve code quality.`;
  }
  if (lower.startsWith("debug") || lower.startsWith("investigate")) {
    return `${intent}. Provide thorough analysis and actionable recommendations.`;
  }
  if (lower.startsWith("test")) {
    return `${intent}. Ensure comprehensive coverage and edge cases.`;
  }

  // Default: pass through with encouragement for thorough analysis
  return `${intent}. Analyze carefully and provide high-quality results.`;
}

const codexIntentProcedures = {
  run: authedProcedure
    .input(codexIntentInputSchema)
    .mutation(async ({ input }) => {
      const prompt = intentToPrompt(input.intent);

      try {
        const chunks: string[] = [];
        const events: AlfredCodexEvent[] = [];

        const result = await toolCodex.execute({
          input: {
            action: "exec" as const,
            prompt,
            out: "text",
            auto: input.auto,
            cw: input.cw,
            authz: input.authz,
            sessionId: input.sessionId,
            context: input.context,
          },
          writer: {
            write: (chunk: unknown) => {
              const event = chunk as {
                type?: string;
                text?: string;
                event?: AlfredCodexEvent;
              };
              if (event.type === "stdout" && typeof event.text === "string") {
                chunks.push(event.text);
              } else if (event.type === "codex_event" && event.event) {
                events.push(event.event);
              }
            },
          },
        });

        return {
          intent: input.intent,
          result: result.result,
          artifacts: result.artifacts ?? [],
          eventCount: events.length,
        };
      } catch (error) {
        if (error instanceof Error && error.message === "biometric_required") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "biometric_required",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }),
};

export const codexIntentRouter = router(codexIntentProcedures);
