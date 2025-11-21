import { limitUiMessages } from "@alfred/type/history";
import type { UIMessage } from "@alfred/type/stream";
import type { Tool, ModelMessage } from "ai";
import {
  convertToModelMessages,
  pruneMessages,
  validateUIMessages,
} from "ai";
import { TRPCError } from "@trpc/server";
import { logger } from "../utils/logger";
import { withBudget } from "@alfred/metrics/performance";

type PrepareMessagesArgs = {
  rawMessages: unknown[];
  tools?: Record<string, Tool>;
  source: "assistant" | "orchestrator";
};

export async function prepareModelMessagesForGenerate({
  rawMessages,
  tools,
  source,
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

      const limited = limitUiMessages(validated);
      const dropped = validated.length - limited.length;
      if (dropped > 0) {
        logger.info(`${source}_history_pruned_generate`, {
          dropped,
          kept: limited.length,
        });
      }

      const modelMessages = convertToModelMessages(limited);
      return pruneMessages({
        messages: modelMessages,
        reasoning: "before-last-message",
        toolCalls: "before-last-2-messages",
        emptyMessages: "remove",
      });
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "invalid_message",
        cause: error,
      });
    }
  });
}
