import { planRepo } from "@alfred/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireUserId, validateIntentUserId } from "../services/plan";
import { authedProcedure, router } from "../trpc.js";

/**
 * planRouter: Handles AI-native workflow planning requests
 */
export const planRouter = router({
  parseIntent: authedProcedure
    .input(
      z.object({
        codebase: z.string().optional(),
        input: z.string().min(1).max(500),
        source: z.enum(["voice", "chat", "api"]).default("chat"),
        workspace: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx.session);

      try {
        const { parseIntent } = await import("@alfred/plan");
        const result = await parseIntent(input.input, {
          codebase: input.codebase,
          source: input.source,
          userId,
          workspace: input.workspace,
        });

        return result;
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_intent_parse_failed",
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
        options: z
          .object({
            dateFilter: z.enum(["recent", "all"]).optional(),
            frameworkMatch: z.boolean().optional(),
            includeContext: z.boolean().optional(),
            maxResults: z.number().int().min(1).max(20).optional(),
            minReliability: z.number().min(0).max(1).optional(),
            searchType: z
              .enum(["auto", "neural", "keyword", "fast", "deep"])
              .optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx.session);
      try {
        const { gatherExternalResearchService } =
          await import("../services/plan");
        return await gatherExternalResearchService(
          input.intent,
          userId,
          input.options as Record<string, unknown>
        );
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_research_external_failed",
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
        options: z.unknown().optional(),
        projectId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx.session);
      try {
        const { gatherInternalResearchService } =
          await import("../services/plan");
        return await gatherInternalResearchService(
          input.intent,
          userId,
          input.projectId,
          input.options
        );
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_research_internal_failed",
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
      const userId = requireUserId(ctx.session);
      try {
        const { gatherFullResearchService } = await import("../services/plan");
        return await gatherFullResearchService(
          input.intent,
          userId,
          input.options
        );
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_research_full_failed",
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
        options: z
          .object({
            maxPhases: z.number().int().min(1).max(10).optional(),
            preferParallel: z.boolean().optional(),
            agentTypes: z.array(z.unknown()).optional(),
          })
          .optional(),
        research: z.unknown(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx.session);

      const {
        agentTypeSchema,
        generatePlan,
        researchResultSchema,
        workflowIntentSchema,
      } = await import("@alfred/plan");
      const intent = workflowIntentSchema.parse(input.intent);
      const research = researchResultSchema.parse(input.research);

      const rawOpts = input.options;
      const options = rawOpts
        ? {
            agentTypes: Array.isArray(rawOpts.agentTypes)
              ? rawOpts.agentTypes.map((t) => agentTypeSchema.parse(t))
              : undefined,
            maxPhases:
              typeof rawOpts.maxPhases === "number"
                ? z.number().int().min(1).max(10).parse(rawOpts.maxPhases)
                : undefined,
            preferParallel:
              typeof rawOpts.preferParallel === "boolean"
                ? rawOpts.preferParallel
                : undefined,
          }
        : undefined;

      // Validate that intent.userId matches authenticated user
      validateIntentUserId(intent, userId);

      try {
        const plan = await generatePlan(intent, research, options);
        return plan;
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_generation_failed",
        });
      }
    }),

  /**
   * Plan critique and revision
   */
  critique: authedProcedure
    .input(
      z.object({
        intent: z.unknown(),
        options: z.unknown().optional(),
        plan: z.unknown(),
        research: z.unknown(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx.session);
      try {
        const { critiquePlanService } = await import("../services/plan");
        return await critiquePlanService(
          input.plan,
          input.intent,
          input.research,
          userId,
          input.options
        );
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_critique_failed",
        });
      }
    }),

  /**
   * Deterministic plan evaluation
   */
  evaluate: authedProcedure
    .input(
      z.object({
        options: z
          .object({
            checks: z
              .array(z.enum(["typecheck", "test", "lint", "build"]))
              .optional(),
          })
          .optional(),
        plan: z.unknown(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { evaluatePlanDeterministic, structuredPlanSchema } =
          await import("@alfred/plan");
        const plan = structuredPlanSchema.parse(input.plan);
        const evaluation = await evaluatePlanDeterministic(plan, input.options);
        return evaluation;
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_evaluation_failed",
        });
      }
    }),

  /**
   * Persist a plan
   */
  create: authedProcedure
    .input(
      z.object({
        intent: z.string(),
        plan: z.unknown(),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx.session);

      try {
        const { structuredPlanSchema } = await import("@alfred/plan");
        const plan = structuredPlanSchema.parse(input.plan);
        return await planRepo.createPlan({
          intent: input.intent,
          plan,
          projectId: input.projectId,
          status: "pending",
          userId,
        });
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_persist_failed",
        });
      }
    }),

  /**
   * Approve and execute a plan
   */
  approve: authedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx.session);

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
      const userId = requireUserId(ctx.session);

      try {
        const { rejectPlan } = await import("@alfred/plan");
        return await rejectPlan(input.planId, userId, input.reason);
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_rejection_failed",
        });
      }
    }),

  /**
   * Get plan by ID
   */
  get: authedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const userId = requireUserId(ctx.session);

      try {
        const { getPlanRecord } = await import("@alfred/plan");
        const plan = await getPlanRecord(input.planId);
        if (!plan) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "plan_not_found",
          });
        }
        if (plan.userId !== userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "plan_access_denied",
          });
        }
        return plan;
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_retrieval_failed",
        });
      }
    }),

  /**
   * List plans with filters
   */
  list: authedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        status: z
          .enum(["pending", "approved", "rejected", "executed"])
          .optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = requireUserId(ctx.session);

      try {
        const { listPlans } = await import("@alfred/plan");
        const plans = await listPlans({
          limit: input.limit,
          offset: input.offset,
          status: input.status,
          userId,
        });
        return plans;
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_listing_failed",
        });
      }
    }),

  /**
   * Convert StructuredPlan to WavePlan (debug endpoint)
   */
  convertToWaves: authedProcedure
    .input(
      z.object({
        maxConcurrency: z.number().int().optional(),
        plan: z.object({
          phases: z.array(z.unknown()),
          resources: z
            .object({
              strategy: z.enum([
                "sequential",
                "parallel",
                "topological",
                "mixed",
              ]),
              agentCount: z.number().int().optional(),
            })
            .optional(),
        }),
      })
    )
    .query(async ({ input }) => {
      try {
        const { planToWaves, structuredPlanSchema } =
          await import("@alfred/plan");
        const waves = planToWaves(structuredPlanSchema.parse(input.plan), {
          maxConcurrency: input.maxConcurrency,
        });
        return waves;
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "wave_conversion_failed",
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
        const { exportPlanToYAML, structuredPlanSchema } =
          await import("@alfred/plan");
        const plan = structuredPlanSchema.parse(input.plan);
        return exportPlanToYAML(plan);
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_export_failed",
        });
      }
    }),

  /**
   * List workflow patterns
   */
  patternsList: authedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional().default(50),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.session);

      try {
        const { patternRepo } = await import("@alfred/db");
        const rows = await patternRepo.listPatternsByUserId(userId);
        const filtered = input.projectId
          ? rows.filter((p) => p.projectId === input.projectId)
          : rows;
        return filtered.slice(0, input.limit);
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "patterns_list_failed",
        });
      }
    }),

  /**
   * Match patterns for a new intent
   */
  patternsMatch: authedProcedure
    .input(
      z.object({
        intent: z.string().min(1).max(1000),
        maxResults: z.number().int().min(1).max(10).optional().default(5),
        minSimilarity: z.number().min(0).max(1).optional().default(0.7),
        projectId: z.string().uuid().optional(),
        requireStructuralMatch: z.boolean().optional().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.session);

      try {
        const { categorizePatterns, matchPatterns } =
          await import("@alfred/plan");
        const matches = await matchPatterns(input.intent, input.projectId, {
          maxResults: input.maxResults,
          minSimilarity: input.minSimilarity,
          requireStructuralMatch: input.requireStructuralMatch,
        });
        return {
          categorized: categorizePatterns(matches),
          matches,
          userId,
        };
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "pattern_match_failed",
        });
      }
    }),

  /**
   * Debug intent parsing with step breakdown
   */
  debugTrace: authedProcedure
    .input(
      z.object({
        input: z.string().min(1).max(500),
        source: z.enum(["voice", "chat", "api"]).default("chat"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx.session);

      try {
        const { parseIntent } = await import("@alfred/plan");
        return await parseIntent(
          input.input,
          { source: input.source, userId },
          { autoResolve: false, maxClarifications: 5 }
        );
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          message: "debug_trace_failed",
        });
      }
    }),
});
