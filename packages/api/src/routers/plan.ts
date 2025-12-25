import {
  gatherExternalResearch,
  gatherFullResearch,
  parseIntent,
  researchOptionsSchema,
  workflowIntentSchema,
  type WorkflowIntent,
} from "@alfred/plan";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc.js";

/**
 * Validates that all userId fields in an intent (including nested intents) match the authenticated user
 */
function validateIntentUserId(intent: WorkflowIntent, authenticatedUserId: string): void {
  if (intent.userId !== authenticatedUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "plan_intent_user_mismatch",
    });
  }
  // Validate nested intents if present
  if (intent.multiIntent?.intents) {
    for (const nestedIntent of intent.multiIntent.intents) {
      validateIntentUserId(nestedIntent, authenticatedUserId);
    }
  }
}

/**
 * planRouter: Handles AI-native workflow planning requests
 */
export const planRouter = router({
  parseIntent: authedProcedure
    .input(
      z.object({
        input: z.string().min(1).max(500),
        source: z.enum(["voice", "chat", "api"]).default("chat"),
        workspace: z.string().optional(),
        codebase: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        const result = await parseIntent(input.input, {
          userId,
          source: input.source,
          workspace: input.workspace,
          codebase: input.codebase,
        });

        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_intent_parse_failed",
          cause: error,
        });
      }
    }),

  /**
   * External research aggregator (returns only external sources)
   */
  externalResearch: authedProcedure
    .input(
      z.object({
        intent: workflowIntentSchema,
        options: researchOptionsSchema.optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Validate that intent.userId matches authenticated user
      validateIntentUserId(input.intent, userId);

      try {
        const results = await gatherExternalResearch(
          input.intent,
          input.options
        );
        return results;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_research_external_failed",
          cause: error,
        });
      }
    }),

  /**
   * Full research aggregator (returns complete ResearchResult with metadata)
   */
  fullResearch: authedProcedure
    .input(
      z.object({
        intent: workflowIntentSchema,
        options: researchOptionsSchema.optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Validate that intent.userId matches authenticated user
      validateIntentUserId(input.intent, userId);

      try {
        const results = await gatherFullResearch(input.intent, input.options);
        return results;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_research_full_failed",
          cause: error,
        });
      }
    }),
});
