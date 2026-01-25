import { getAggregateStats, getTracker } from "@alfred/history";
import { calculateCostUsd, getModelPricing } from "@alfred/metrics";
import { parseModelKey } from "@alfred/type/model";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getMetricsJSON } from "../metrics";
import { protectedProcedure, router } from "../trpc";

export const metricsRouter = router({
  estimateCost: protectedProcedure
    .input(
      z.object({
        modelId: z.string().min(1),
        usage: z
          .object({
            inputTokens: z.number().int().min(0).optional(),
            outputTokens: z.number().int().min(0).optional(),
            reasoningTokens: z.number().int().min(0).optional(),
            cachedInputTokens: z.number().int().min(0).optional(),
          })
          .optional(),
      })
    )
    .query(({ input }) => {
      const raw = input.modelId.trim();
      const normalized = raw.includes(":") ? raw.replace(":", "/") : raw;

      let provider: ReturnType<typeof parseModelKey>["provider"];
      let modelKey: string;
      let modelId: string;
      try {
        const parsed = parseModelKey(normalized);
        ({ provider } = parsed);
        modelKey = parsed.key;
        ({ modelId } = parsed);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "invalid_model_key",
          cause: error,
        });
      }

      const usage = input.usage ?? {};
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const reasoningTokens = usage.reasoningTokens ?? 0;
      const cachedInputTokens = usage.cachedInputTokens ?? 0;

      const pricing = getModelPricing(provider, modelId);

      const inputUsd = calculateCostUsd(provider, modelId, inputTokens, 0);
      const outputUsd = calculateCostUsd(provider, modelId, 0, outputTokens);
      const reasoningUsd = calculateCostUsd(
        provider,
        modelId,
        0,
        reasoningTokens
      );
      const cacheUsd = calculateCostUsd(
        provider,
        modelId,
        cachedInputTokens,
        0
      );
      const totalUsd = inputUsd + outputUsd + reasoningUsd + cacheUsd;

      return {
        modelKey,
        provider,
        modelId,
        pricing,
        tokens: {
          inputTokens,
          outputTokens,
          reasoningTokens,
          cachedInputTokens,
        },
        costUsd: {
          totalUsd,
          inputUsd,
          outputUsd,
          reasoningUsd,
          cacheUsd,
        },
      };
    }),

  getAggregateUsage: protectedProcedure.query(() => {
    return getAggregateStats();
  }),

  getBudgetStatus: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .query(({ input }) => {
      const tracker = getTracker(input.sessionId);
      return tracker?.getBudgetStatus() ?? null;
    }),

  getSnapshot: protectedProcedure.query(async () => await getMetricsJSON()),
});
