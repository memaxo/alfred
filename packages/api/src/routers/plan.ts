import { planRepo } from "@alfred/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc.js";

/**
 * Validates that all userId fields in an intent (including nested intents) match the authenticated user
 */
function validateIntentUserId(
  intent: {
    userId: string;
    multiIntent?: { intents?: unknown[] } | null;
  },
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
      const candidate = nestedIntent as {
        userId?: unknown;
        multiIntent?: { intents?: unknown[] } | null;
      };
      if (typeof candidate.userId === "string") {
        validateIntentUserId(
          { userId: candidate.userId, multiIntent: candidate.multiIntent },
          authenticatedUserId
        );
      }
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
        const { parseIntent } = await import("@alfred/plan");
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
        intent: z.unknown(),
        options: z.unknown().optional(),
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

      const {
        gatherExternalResearch,
        researchOptionsSchema,
        workflowIntentSchema,
      } = await import("@alfred/plan");
      const intent = workflowIntentSchema.parse(input.intent);
      const options = input.options
        ? researchOptionsSchema.parse(input.options)
        : undefined;

      // Validate that intent.userId matches authenticated user
      validateIntentUserId(intent, userId);

      try {
        const results = await gatherExternalResearch(intent, options);
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
        intent: z.unknown(),
        projectId: z.string().optional(),
        options: z.unknown().optional(),
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

      const { gatherInternalResearch, workflowIntentSchema } = await import(
        "@alfred/plan"
      );
      const intent = workflowIntentSchema.parse(input.intent);

      // Validate that intent.userId matches authenticated user
      validateIntentUserId(intent, userId);

      try {
        const results = await gatherInternalResearch(
          intent,
          input.projectId,
          input.options as Record<string, unknown>
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
        intent: z.unknown(),
        options: z.unknown().optional(),
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

      const {
        gatherFullResearch,
        researchOptionsSchema,
        workflowIntentSchema,
      } = await import("@alfred/plan");
      const intent = workflowIntentSchema.parse(input.intent);
      const options = input.options
        ? researchOptionsSchema.parse(input.options)
        : undefined;

      // Validate that intent.userId matches authenticated user
      validateIntentUserId(intent, userId);

      try {
        const results = await gatherFullResearch(intent, options);
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
        intent: z.unknown(),
        research: z.unknown(),
        options: z
          .object({
            maxPhases: z.number().int().min(1).max(10).optional(),
            preferParallel: z.boolean().optional(),
            agentTypes: z.array(z.unknown()).optional(),
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

      const {
        agentTypeSchema,
        generatePlan,
        researchResultSchema,
        workflowIntentSchema,
      } = await import("@alfred/plan");
      const intent = workflowIntentSchema.parse(input.intent);
      const research = researchResultSchema.parse(input.research);
      const optionsSchema = z
        .object({
          maxPhases: z.number().int().min(1).max(10).optional(),
          preferParallel: z.boolean().optional(),
          agentTypes: z.array(agentTypeSchema).optional(),
        })
        .optional();
      const options = optionsSchema.parse(input.options);

      // Validate that intent.userId matches authenticated user
      validateIntentUserId(intent, userId);

      try {
        const plan = await generatePlan(intent, research, options);
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
        plan: z.unknown(),
        intent: z.unknown(),
        research: z.unknown(),
        options: z.unknown().optional(),
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

      const {
        critiquePlan,
        researchResultSchema,
        structuredPlanSchema,
        workflowIntentSchema,
      } = await import("@alfred/plan");
      const plan = structuredPlanSchema.parse(input.plan);
      const intent = workflowIntentSchema.parse(input.intent);
      const research = researchResultSchema.parse(input.research);
      const optionsSchema = z
        .object({
          maxRevisions: z.number().int().min(1).max(5).optional(),
        })
        .optional();
      const options = optionsSchema.parse(input.options);

      // Validate that intent.userId matches authenticated user
      validateIntentUserId(intent, userId);

      try {
        const result = await critiquePlan(plan, intent, research, options);
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
        plan: z.unknown(),
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
        const { evaluatePlanDeterministic, structuredPlanSchema } =
          await import("@alfred/plan");
        const plan = structuredPlanSchema.parse(input.plan);
        const evaluation = await evaluatePlanDeterministic(plan, input.options);
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
        plan: z.unknown(),
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
        const { structuredPlanSchema } = await import("@alfred/plan");
        const plan = structuredPlanSchema.parse(input.plan);
        return await planRepo.createPlan({
          userId,
          projectId: input.projectId,
          intent: input.intent,
          plan,
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
        const { approvePlan } = await import("@alfred/plan");
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
        const { rejectPlan } = await import("@alfred/plan");
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
    .input(z.object({ plan: z.unknown() }))
    .query(async ({ input }) => {
      try {
        const { exportPlanToYAML, structuredPlanSchema } = await import(
          "@alfred/plan"
        );
        const plan = structuredPlanSchema.parse(input.plan);
        return exportPlanToYAML(plan);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_export_failed",
          cause: error,
        });
      }
    }),
});
