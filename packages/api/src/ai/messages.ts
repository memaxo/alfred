import type { UIMessage } from "@alfred/type/stream";
import type { LanguageModel, ModelMessage, Tool } from "ai";

import { buildHistoryContext, calculateBudget } from "@alfred/history";
import { ContextBudgetManager } from "@alfred/history/budget-manager";
import { logger } from "@alfred/logger";
import { withBudget } from "@alfred/metrics/performance";
import { createTokenEstimator } from "@alfred/metrics/token";
import { TRPCError } from "@trpc/server";
import { validateUIMessages } from "ai";

import {
  contextBudgetAllocation,
  contextBudgetUtilization,
  historyContextTierDropsTotal,
  historyContextTokensTotal,
  runtimeHistorySelectionDurationSeconds,
} from "../metrics";
import { modelRoleForSource, resolveModelKey } from "./model";

interface PrepareMessagesArgs {
  rawMessages: unknown[];
  tools?: Record<string, Tool>;
  source: "assistant" | "orchestrator";
  model?: string | LanguageModel;
  system?: string;
  budgetManager?: ContextBudgetManager;
}

export function prepareModelMessagesForGenerate({
  rawMessages,
  tools,
  source,
  model,
  system,
  budgetManager,
}: PrepareMessagesArgs): Promise<ModelMessage[]> {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "invalid_message",
    });
  }

  return withBudget(`prepare_model_messages_${source}`, 10, async () => {
    try {
      const validated = (await validateUIMessages({
        messages: rawMessages,
        tools: tools as Parameters<typeof validateUIMessages>[0]["tools"],
      })) as UIMessage[];
      const modelId = resolveModelId(source, model);

      const estimator = createTokenEstimator({ model: modelId });
      const systemTokens =
        typeof system === "string" ? estimator.estimate(system) : 0;
      const budget =
        budgetManager ??
        new ContextBudgetManager({
          modelId,
          systemTokens,
          coreToolNames: tools ? Object.keys(tools) : undefined,
        });
      const enforcedTools = tools
        ? budget.enforceTools(tools).tools
        : undefined;
      const calculated = calculateBudget({ modelId, systemTokens });

      const stopHistoryTimer =
        runtimeHistorySelectionDurationSeconds.startTimer();
      const historyContext = await buildHistoryContext({
        messages: validated,
        modelId,
        system,
        source,
        tools: enforcedTools,
        budget: {
          maxContextTokens: calculated.effectiveContextTokens,
          historyRatio: calculated.historyRatio,
          minSystemReserveTokens: calculated.systemReserveTokens,
          minHeadroomTokens: calculated.headroomTokens,
          reservedToolingTokens: calculated.toolingReserveTokens,
        },
      });
      stopHistoryTimer();

      budget._setHistoryUsed(historyContext.keptTokens);
      const snap = budget.snapshot();
      for (const [src, tokens] of Object.entries(snap.allocated)) {
        contextBudgetAllocation.observe(
          { model: modelId, source: src },
          tokens as number
        );
      }
      for (const [src, ratio] of Object.entries(snap.utilization)) {
        contextBudgetUtilization.observe(
          { model: modelId, source: src },
          ratio as number
        );
      }

      historyContextTokensTotal.inc(
        { source, model: modelId, action: "kept" },
        historyContext.keptTokens
      );
      historyContextTokensTotal.inc(
        { source, model: modelId, action: "dropped" },
        historyContext.droppedTokens
      );

      if (historyContext.selection.dropped.length > 0) {
        for (const message of historyContext.selection.dropped) {
          const tier =
            historyContext.selection.tierByMessage.get(message) ?? "low";
          historyContextTierDropsTotal.inc({ source, tier });
        }
      }

      if (historyContext.droppedMessages > 0) {
        logger.info(`${source}_history_pruned_generate`, {
          dropped: historyContext.droppedMessages,
          kept: historyContext.uiMessages.length,
          keptTokens: historyContext.keptTokens,
          droppedTokens: historyContext.droppedTokens,
        });
      }

      return historyContext.modelMessages;
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "invalid_message",
        cause: error,
      });
    }
  });
}

function resolveModelId(
  source: "assistant" | "orchestrator",
  model?: string | LanguageModel
): string {
  return resolveModelKey({ role: modelRoleForSource(source), model });
}
