import { patternRepo, planRepo } from "@alfred/db";
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
        options: z
          .object({
            maxResults: z.number().int().min(1).max(20).optional(),
            minReliability: z.number().min(0).max(1).optional(),
            dateFilter: z.enum(["recent", "all"]).optional(),
            frameworkMatch: z.boolean().optional(),
            searchType: z
              .enum(["auto", "neural", "keyword", "fast", "deep"])
              .optional(),
            includeContext: z.boolean().optional(),
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

      const { gatherExternalResearch, workflowIntentSchema } = await import(
        "@alfred/plan"
      );
      const intent = workflowIntentSchema.parse(input.intent);

      // Validate that intent.userId matches authenticated user
      validateIntentUserId(intent, userId);

      try {
        const results = await gatherExternalResearch(intent, input.options);
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
   * Get plan by ID
   */
  get: authedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

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
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_retrieval_failed",
          cause: error,
        });
      }
    }),

  /**
   * List plans with filters
   */
  list: authedProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "approved", "rejected", "executed"])
          .optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        const { listPlans } = await import("@alfred/plan");
        const plans = await listPlans({
          userId,
          status: input.status,
          limit: input.limit,
          offset: input.offset,
        });
        return plans;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "plan_listing_failed",
          cause: error,
        });
      }
    }),

  /**
   * Convert StructuredPlan to WavePlan (debug endpoint)
   */
  convertToWaves: authedProcedure
    .input(
      z.object({
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
        maxConcurrency: z.number().int().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const { planToWaves, structuredPlanSchema } = await import(
          "@alfred/plan"
        );
        const waves = planToWaves(structuredPlanSchema.parse(input.plan), {
          maxConcurrency: input.maxConcurrency,
        });
        return waves;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "wave_conversion_failed",
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

  /**
   * List workflow patterns
   */
  patternsList: authedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        const patterns = await patternRepo.listPatternsByUserId(userId);

        // Filter by project if specified
        const filtered = input.projectId
          ? patterns.filter((p) => p.projectId === input.projectId)
          : patterns;

        // Sort by usage count descending
        const sorted = filtered.sort(
          (a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0)
        );

        return {
          patterns: sorted.slice(0, input.limit).map((p) => ({
            id: p.id,
            trigger: p.trigger,
            planTemplate: p.planTemplate,
            successRate: p.successRate,
            avgDurationMs: p.avgDurationMs,
            usageCount: p.usageCount,
            projectId: p.projectId,
            createdAt: p.createdAt?.toISOString() ?? null,
            updatedAt: p.updatedAt?.toISOString() ?? null,
          })),
          total: filtered.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "patterns_list_failed",
          cause: error,
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
        projectId: z.string().uuid().optional(),
        minSimilarity: z.number().min(0).max(1).optional().default(0.7),
        maxResults: z.number().int().min(1).max(10).optional().default(5),
        requireStructuralMatch: z.boolean().optional().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        const { matchPatterns, categorizePatterns } = await import(
          "@alfred/plan/pattern"
        );

        // Match patterns
        const matches = await matchPatterns(input.intent, input.projectId, {
          minSimilarity: input.minSimilarity,
          maxResults: input.maxResults,
          requireStructuralMatch: input.requireStructuralMatch,
        });

        // Categorize by confidence
        const categorized = categorizePatterns(matches);

        return {
          matches: matches.map((m) => ({
            id: m.id,
            trigger: m.trigger,
            planTemplate: m.planTemplate,
            successRate: m.successRate,
            avgDurationMs: m.avgDurationMs,
            usageCount: m.usageCount,
            similarity: m.similarity,
            confidence: m.similarity * Number.parseFloat(m.successRate),
            projectId: m.projectId,
            createdAt: m.createdAt?.toISOString() ?? null,
            updatedAt: m.updatedAt?.toISOString() ?? null,
          })),
          categories: {
            autoSuggest: categorized.autoSuggest.map((m) => ({
              id: m.id,
              trigger: m.trigger,
              similarity: m.similarity,
              confidence: m.similarity * Number.parseFloat(m.successRate),
            })),
            requireConfirmation: categorized.requireConfirmation.map((m) => ({
              id: m.id,
              trigger: m.trigger,
              similarity: m.similarity,
              confidence: m.similarity * Number.parseFloat(m.successRate),
            })),
            lowConfidence: categorized.lowConfidence.map((m) => ({
              id: m.id,
              trigger: m.trigger,
              similarity: m.similarity,
              confidence: m.similarity * Number.parseFloat(m.successRate),
            })),
          },
          total: matches.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "pattern_match_failed",
          cause: error,
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
    .mutation(async ({ ctx, input: requestInput }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const startTime = Date.now();
      const trace: {
        step: string;
        durationMs: number;
        output: unknown;
      }[] = [];

      try {
        const { parseIntent } = await import("@alfred/plan");

        // Step 1: Tokenize / preprocess
        const preprocessStart = Date.now();
        const preprocessed = requestInput.input.trim().toLowerCase();
        trace.push({
          step: "preprocess",
          durationMs: Date.now() - preprocessStart,
          output: {
            original: requestInput.input,
            normalized: preprocessed,
            wordCount: preprocessed.split(/\s+/).length,
          },
        });

        // Step 2: Parse intent
        const parseStart = Date.now();
        const result = await parseIntent(requestInput.input, {
          userId,
          source: requestInput.source,
        });

        // Handle discriminated union result
        let intentData: unknown = null;
        let confidence = 0;
        let intentType = "unknown";
        let hasMultiIntent = false;

        if (result.type === "intent") {
          intentData = result.intent;
          intentType = "single";
          hasMultiIntent = !!result.intent.multiIntent?.split;
          confidence = result.intent.ambiguity?.score
            ? 1 - result.intent.ambiguity.score
            : 0.8;
        } else if (result.type === "multiIntent") {
          intentData = result.intents;
          intentType = "multi";
          hasMultiIntent = true;
          confidence = 0.7;
        } else if (result.type === "clarification") {
          intentType = "clarification";
          intentData = { questions: result.questions };
          confidence = 0.3;
        }

        trace.push({
          step: "parseIntent",
          durationMs: Date.now() - parseStart,
          output: {
            resultType: result.type,
            intentType,
            confidence,
            hasMultiIntent,
          },
        });

        // Step 3: Extract entities
        const entityStart = Date.now();
        const entities: Record<string, unknown>[] = [];
        if (result.type === "intent") {
          const intent = result.intent;
          if (intent.context.projectId) {
            entities.push({ type: "project", value: intent.context.projectId });
          }
          if (intent.context.workspace) {
            entities.push({
              type: "workspace",
              value: intent.context.workspace,
            });
          }
          if (intent.context.codebase) {
            entities.push({ type: "codebase", value: intent.context.codebase });
          }
          for (const constraint of intent.context.constraints) {
            entities.push({
              type: `constraint:${constraint.type}`,
              value: constraint.value,
            });
          }
        }
        trace.push({
          step: "extractEntities",
          durationMs: Date.now() - entityStart,
          output: { entities, count: entities.length },
        });

        // Step 4: Classify complexity
        const classifyStart = Date.now();
        let complexity = "low";
        if (result.type === "multiIntent") {
          complexity = "multi";
        } else if (result.type === "intent") {
          const constraintCount = result.intent.context.constraints.length;
          const patternCount = result.intent.context.existingPatterns.length;
          if (constraintCount > 2 || patternCount === 0) {
            complexity = "high";
          } else if (constraintCount > 0 || hasMultiIntent) {
            complexity = "medium";
          }
        } else if (result.type === "clarification") {
          complexity = "needs_clarification";
        }
        trace.push({
          step: "classifyComplexity",
          durationMs: Date.now() - classifyStart,
          output: { complexity },
        });

        const totalDurationMs = Date.now() - startTime;

        return {
          input: requestInput.input,
          resultType: result.type,
          intent: intentData,
          confidence,
          trace,
          totalDurationMs,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "debug_trace_failed",
          cause: error,
        });
      }
    }),
});
