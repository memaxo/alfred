import { planRepo } from "@alfred/db";
import {
  agentTypeSchema,
  approvePlan,
  critiquePlan,
  evaluatePlanDeterministic,
  exportPlanToYAML,
  gatherExternalResearch,
  gatherFullResearch,
  gatherInternalResearch,
  generatePlan,
  parseIntent,
  rejectPlan,
  researchOptionsSchema,
  researchResultSchema,
  structuredPlanSchema,
  type WorkflowIntent,
  workflowIntentSchema,
} from "@alfred/plan";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc.js";

/**
 * Validates that all userId fields in an intent (including nested intents) match the authenticated user
 */
function validateIntentUserId(
  intent: WorkflowIntent,
  authenticatedUserId: string
): void {
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
   * Internal research aggregator (returns codebase, patterns, conventions)
   */
  internalResearch: authedProcedure
    .input(
      z.object({
        intent: workflowIntentSchema,
        projectId: z.string().optional(),
        options: z
          .object({
            maxFiles: z.number().int().min(1).max(50).optional(),
            includePatterns: z.boolean().optional(),
            includeConventions: z.boolean().optional(),
          })
          .optional(),
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
        const results = await gatherInternalResearch(
          input.intent,
          input.projectId,
          input.options
        );
        return results;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_research_internal_failed",
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

  /**
   * Phased plan generator
   */
  generate: authedProcedure
    .input(
      z.object({
        intent: workflowIntentSchema,
        research: researchResultSchema,
        options: z
          .object({
            maxPhases: z.number().int().min(1).max(10).optional(),
            preferParallel: z.boolean().optional(),
            agentTypes: z.array(agentTypeSchema).optional(),
          })
          .optional(),
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
        const plan = await generatePlan(
          input.intent,
          input.research,
          input.options
        );
        return plan;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_generation_failed",
          cause: error,
        });
      }
    }),

  /**
   * Plan critique and revision
   */
  critique: authedProcedure
    .input(
      z.object({
        plan: structuredPlanSchema,
        intent: workflowIntentSchema,
        research: researchResultSchema,
        options: z
          .object({
            maxRevisions: z.number().int().min(1).max(5).optional(),
          })
          .optional(),
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
        const result = await critiquePlan(
          input.plan,
          input.intent,
          input.research,
          input.options
        );
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_critique_failed",
          cause: error,
        });
      }
    }),

  /**
   * Deterministic plan evaluation
   */
  evaluate: authedProcedure
    .input(
      z.object({
        plan: structuredPlanSchema,
        options: z
          .object({
            checks: z
              .array(z.enum(["typecheck", "test", "lint", "build"]))
              .optional(),
          })
          .optional(),
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
        const evaluation = await evaluatePlanDeterministic(
          input.plan,
          input.options
        );
        return evaluation;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_evaluation_failed",
          cause: error,
        });
      }
    }),

  /**
   * Persist a plan
   */
  create: authedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        intent: z.string(),
        plan: structuredPlanSchema,
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
        return await planRepo.createPlan({
          userId,
          projectId: input.projectId,
          intent: input.intent,
          plan: input.plan,
          status: "pending",
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_persist_failed",
          cause: error,
        });
      }
    }),

  /**
   * Approve and execute a plan
   */
  approve: authedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        return await approvePlan(input.planId, userId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "plan_approval_failed",
        });
      }
    }),

  /**
   * Reject a plan
   */
  reject: authedProcedure
    .input(
      z.object({
        planId: z.string().uuid(),
        reason: z.string().optional(),
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
        return await rejectPlan(input.planId, userId, input.reason);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_rejection_failed",
          cause: error,
        });
      }
    }),

  /**
   * Export plan to YAML
   */
  exportYAML: authedProcedure
    .input(z.object({ plan: structuredPlanSchema }))
    .query(async ({ input }) => {
      try {
        return exportPlanToYAML(input.plan);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_export_failed",
          cause: error,
        });
      }
    }),
});
