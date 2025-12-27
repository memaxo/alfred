/**
 * ALFRED Budget Router
 * API endpoints for budget management and usage tracking
 */

import {
  type CostPriority,
  getBudgetManager,
  type ModelRole,
} from "@alfred/agent/budget";
import * as budgetRepo from "@alfred/db/repo/budget";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

// ============================================================================
// Schemas
// ============================================================================

const budgetSettingsSchema = z.object({
  dailyDollarLimit: z.number().min(0).max(1000).nullable().optional(),
  dailyTokenLimit: z
    .number()
    .int()
    .min(0)
    .max(100_000_000)
    .nullable()
    .optional(),
  maxLatencyMs: z.number().int().min(100).max(60_000).nullable().optional(),
  maxTokensPerRequest: z
    .number()
    .int()
    .min(100)
    .max(1_000_000)
    .nullable()
    .optional(),
  costPriority: z.enum(["minimize", "balanced", "maximize_quality"]).optional(),
  modelPreferences: z
    .record(
      z.enum([
        "chat",
        "orchestrator",
        "planner",
        "background",
        "voice",
        "fast",
      ]),
      z.string()
    )
    .optional(),
});

const usageQuerySchema = z.object({
  days: z.number().int().min(1).max(90).default(30),
});

// ============================================================================
// Router
// ============================================================================

export const budgetRouter = router({
  /**
   * Get current budget settings
   */
  get: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const budget = await budgetRepo.getUserBudget(session.user.id);

    if (!budget) {
      // Return defaults
      return {
        dailyDollarLimit: null,
        dailyTokenLimit: null,
        maxLatencyMs: null,
        maxTokensPerRequest: null,
        costPriority: "balanced" as CostPriority,
        modelPreferences: null,
      };
    }

    return {
      dailyDollarLimit: budget.dailyDollarLimit,
      dailyTokenLimit: budget.dailyTokenLimit,
      maxLatencyMs: budget.maxLatencyMs,
      maxTokensPerRequest: budget.maxTokensPerRequest,
      costPriority: (budget.costPriority ?? "balanced") as CostPriority,
      modelPreferences: budget.modelPreferences as Record<
        ModelRole,
        string
      > | null,
    };
  }),

  /**
   * Update budget settings
   */
  set: authedProcedure
    .input(budgetSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const budget = await budgetRepo.upsertUserBudget(session.user.id, {
        dailyDollarLimit: input.dailyDollarLimit ?? null,
        dailyTokenLimit: input.dailyTokenLimit ?? null,
        maxLatencyMs: input.maxLatencyMs ?? null,
        maxTokensPerRequest: input.maxTokensPerRequest ?? null,
        costPriority: input.costPriority,
        modelPreferences: input.modelPreferences,
      });

      // Clear cached settings in budget manager
      const manager = getBudgetManager(session.user.id);
      manager.clearSettingsCache();

      return {
        dailyDollarLimit: budget.dailyDollarLimit,
        dailyTokenLimit: budget.dailyTokenLimit,
        maxLatencyMs: budget.maxLatencyMs,
        maxTokensPerRequest: budget.maxTokensPerRequest,
        costPriority: (budget.costPriority ?? "balanced") as CostPriority,
        modelPreferences: budget.modelPreferences as Record<
          ModelRole,
          string
        > | null,
      };
    }),

  /**
   * Get today's usage
   */
  usage: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const manager = getBudgetManager(session.user.id);
    const usage = await manager.getDailyUsage();

    return {
      date: usage.date.toISOString(),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens,
      totalTokens: usage.totalTokens,
      totalCostCents: usage.totalCostCents,
      totalCostDollars: usage.totalCostDollars,
      requestCount: usage.requestCount,
      blockedCount: usage.blockedCount,
      providerBreakdown: usage.providerBreakdown,
      roleBreakdown: usage.roleBreakdown,
    };
  }),

  /**
   * Get usage history
   */
  history: authedProcedure
    .input(usageQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const days = input?.days ?? 30;
      const manager = getBudgetManager(session.user.id);
      const history = await manager.getUsageHistory(days);

      return history.map((usage) => ({
        date: usage.date.toISOString(),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedTokens: usage.cachedTokens,
        totalTokens: usage.totalTokens,
        totalCostCents: usage.totalCostCents,
        totalCostDollars: usage.totalCostDollars,
        requestCount: usage.requestCount,
        blockedCount: usage.blockedCount,
        providerBreakdown: usage.providerBreakdown,
        roleBreakdown: usage.roleBreakdown,
      }));
    }),

  /**
   * Check remaining budget
   */
  remaining: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const manager = getBudgetManager(session.user.id);
    const settings = await manager.getSettings();
    const usage = await manager.getDailyUsage();

    const dollarLimit = settings.dailyDollarLimit;
    const tokenLimit = settings.dailyTokenLimit;

    let dollarsRemaining: number | null = null;
    let tokensRemaining: number | null = null;
    let percentUsed = 0;

    if (dollarLimit) {
      dollarsRemaining = Math.max(0, dollarLimit - usage.totalCostDollars);
      percentUsed = Math.max(percentUsed, usage.totalCostDollars / dollarLimit);
    }

    if (tokenLimit) {
      tokensRemaining = Math.max(0, tokenLimit - usage.totalTokens);
      percentUsed = Math.max(percentUsed, usage.totalTokens / tokenLimit);
    }

    return {
      dollarsRemaining,
      tokensRemaining,
      percentUsed: Math.min(1, percentUsed),
      dollarsUsed: usage.totalCostDollars,
      tokensUsed: usage.totalTokens,
      hasLimits: dollarLimit !== null || tokenLimit !== null,
    };
  }),

  /**
   * Forecast end-of-day usage
   */
  forecast: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const manager = getBudgetManager(session.user.id);
    const settings = await manager.getSettings();
    const usage = await manager.getDailyUsage();
    const history = await manager.getUsageHistory(7);

    // Calculate average daily usage from history
    const totalHistoryDollars = history.reduce(
      (sum, day) => sum + day.totalCostDollars,
      0
    );
    const totalHistoryTokens = history.reduce(
      (sum, day) => sum + day.totalTokens,
      0
    );
    const avgDailyDollars =
      history.length > 0 ? totalHistoryDollars / history.length : 0;
    const avgDailyTokens =
      history.length > 0 ? totalHistoryTokens / history.length : 0;

    // Calculate time-based projection for today
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const elapsedMs = now.getTime() - startOfDay.getTime();
    const totalDayMs = endOfDay.getTime() - startOfDay.getTime();
    const dayProgress = elapsedMs / totalDayMs;

    // Project current usage to end of day
    const projectedDollars =
      dayProgress > 0 ? usage.totalCostDollars / dayProgress : avgDailyDollars;
    const projectedTokens =
      dayProgress > 0 ? usage.totalTokens / dayProgress : avgDailyTokens;

    // Check if on track to exceed limits
    const willExceedDollarLimit =
      settings.dailyDollarLimit !== null &&
      projectedDollars > settings.dailyDollarLimit;
    const willExceedTokenLimit =
      settings.dailyTokenLimit !== null &&
      projectedTokens > settings.dailyTokenLimit;

    return {
      projectedDollars: Math.round(projectedDollars * 100) / 100,
      projectedTokens: Math.round(projectedTokens),
      avgDailyDollars: Math.round(avgDailyDollars * 100) / 100,
      avgDailyTokens: Math.round(avgDailyTokens),
      dayProgress: Math.round(dayProgress * 100) / 100,
      willExceedDollarLimit,
      willExceedTokenLimit,
      warnings: [
        ...(willExceedDollarLimit
          ? [
              `On track to exceed daily dollar limit of $${settings.dailyDollarLimit}`,
            ]
          : []),
        ...(willExceedTokenLimit
          ? [
              `On track to exceed daily token limit of ${settings.dailyTokenLimit}`,
            ]
          : []),
      ],
    };
  }),

  /**
   * Get recent usage events for debugging/analysis
   */
  events: authedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const events = await budgetRepo.getRecentUsageEvents(
        session.user.id,
        input.limit
      );

      return events.map((event) => ({
        id: event.id,
        modelRef: event.modelRef,
        provider: event.provider,
        role: event.role,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cachedTokens: event.cachedTokens,
        costCents: event.costCents,
        latencyMs: event.latencyMs,
        timestamp: event.timestamp?.toISOString() ?? null,
      }));
    }),
});
