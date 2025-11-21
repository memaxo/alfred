import type { UIMessage } from "@alfred/type/stream";
import type { Tool, ModelMessage, LanguageModel } from "ai";
import { validateUIMessages } from "ai";
import { TRPCError } from "@trpc/server";
import { logger } from "../utils/logger";
import { withBudget } from "@alfred/metrics/performance";
import {
  historyContextSelectionDurationSeconds,
  historyContextTierDropsTotal,
  historyContextTokensTotal,
} from "../metrics";
import { buildHistoryContext, getHistoryBudgetDefaults } from "@alfred/history";

type PrepareMessagesArgs = {
  rawMessages: unknown[];
  tools?: Record<string, Tool>;
  source: "assistant" | "orchestrator";
  model?: string | LanguageModel;
  system?: string;
};

export async function prepareModelMessagesForGenerate({
  rawMessages,
  tools,
  source,
  model,
  system,
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
      const modelId = resolveModelId(model);
      const stopHistoryTimer =
        historyContextSelectionDurationSeconds.startTimer({ source });
      const historyContext = await buildHistoryContext({
        messages: validated,
        modelId,
        system,
        source,
        budget: getHistoryBudgetDefaults(),
      });
      stopHistoryTimer();

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

function resolveModelId(model?: string | LanguageModel): string {
  if (typeof model === "string" && model.length > 0) {
    return model;
  }
  if (model && typeof model === "object") {
    const maybeId = (model as { modelId?: unknown }).modelId;
    if (typeof maybeId === "string" && maybeId.length > 0) {
      return maybeId;
    }
  }
  return process.env.AI_MODEL ?? "openai/gpt-4o-mini";
}
