import { getModelId } from "@alfred/agent";
import { buildPreferenceSystemPrompt } from "@alfred/agent/preference/prompt";
import {
  historyContextSelectionDurationSeconds,
  historyContextTierDropsTotal,
  historyContextTokensTotal,
  preferenceHistoryPrunedTotal,
  preferencePromptFailuresTotal,
  preferencePromptInjectionsTotal,
} from "@alfred/api/metrics";
import { triggerPreferenceRefresh } from "@alfred/api/preference/refresh";
import { auth } from "@alfred/auth";
import * as conversationRepo from "@alfred/db/repo/conversation";
import { buildHistoryContext, getHistoryBudgetDefaults } from "@alfred/history";
import { logger } from "@alfred/logger";
import { uiMessageSchema } from "@alfred/type/stream.zod";
import { consumeStream, generateId, streamText, type UIMessage } from "ai";
import { z } from "zod";

const requestSchema = z
  .object({
    messages: z.array(uiMessageSchema).optional(),
    conversationId: z.string().min(1).optional(),
  })
  .passthrough();

type StreamArgs = Parameters<typeof streamText>[0];
type AgentDefaults = Pick<
  StreamArgs,
  "model" | "tools" | "stopWhen" | "prepareStep"
>;
type GetDefaultsFn = () => AgentDefaults;
type ContextAnalysisResult = {
  system?: string;
  activation?: Record<string, unknown>;
};
type AnalyzeContextFn = (
  messages: UIMessage[]
) => Promise<ContextAnalysisResult>;

export async function handleStreamRequest(
  request: Request,
  getDefaults: GetDefaultsFn,
  errorPrefix: string,
  analyzeContext?: AnalyzeContextFn
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await request.json();
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          issues: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const messages = (parsed.data.messages ?? []) as UIMessage[];
    const persistedMessageIds = new Set<string>();

    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id ?? null;

    let conversationId =
      typeof parsed.data.conversationId === "string"
        ? parsed.data.conversationId
        : undefined;

    if (userId && !conversationId) {
      const conversation = await conversationRepo.createConversation(userId);
      conversationId = conversation.id;
    }

    const scheduleRefresh = (reason: string, persisted: number) => {
      if (!userId || persisted === 0) {
        return;
      }
      triggerPreferenceRefresh(userId, { reason });
    };

    if (userId && conversationId) {
      const persisted = await persistMessages({
        conversationId,
        userId,
        messages,
        existingMessageIds: persistedMessageIds,
      });
      scheduleRefresh(`${errorPrefix}_history_seed`, persisted);
    }

    let preferencePrompt: string | undefined;
    let contextSystem: string | undefined;
    let activationData: Record<string, unknown> | undefined;

    if (analyzeContext) {
      try {
        const analysis = await analyzeContext(messages);
        contextSystem = analysis.system;
        activationData = analysis.activation;
      } catch (e) {
        logger.warn(`${errorPrefix}_context_analysis_failed`, {
          error: String(e),
        });
      }
    }

    const defaults = getDefaults();
    const tools = defaults.tools ?? {};

    if (userId) {
      try {
        const prompt = await buildPreferenceSystemPrompt(userId, {
          conversationType: errorPrefix === "assistant" ? "assistant" : "chat",
          toolNames: tools ? Object.keys(tools) : undefined,
        });
        preferencePrompt = prompt || undefined;
        if (preferencePrompt) {
          preferencePromptInjectionsTotal.inc({ source: errorPrefix });
        }
      } catch (error) {
        preferencePromptFailuresTotal.inc({ source: errorPrefix });
        logger.warn(`${errorPrefix}_preference_prompt_failed`, {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const combinedSystem = [preferencePrompt, contextSystem]
      .filter(Boolean)
      .join("\n\n");

    const modelId = getModelId();
    const stopHistoryTimer = historyContextSelectionDurationSeconds.startTimer({
      source: errorPrefix,
    });
    const historyContext = await buildHistoryContext({
      messages,
      modelId,
      system: combinedSystem,
      source: errorPrefix,
      budget: getHistoryBudgetDefaults(),
    });
    stopHistoryTimer();

    const preparedUiMessages = historyContext.uiMessages;
    const modelMessages = historyContext.modelMessages;
    const dropped = historyContext.droppedMessages;

    historyContextTokensTotal.inc(
      { source: errorPrefix, model: modelId, action: "kept" },
      historyContext.keptTokens
    );
    historyContextTokensTotal.inc(
      { source: errorPrefix, model: modelId, action: "dropped" },
      historyContext.droppedTokens
    );

    if (historyContext.selection.dropped.length > 0) {
      for (const message of historyContext.selection.dropped) {
        const tier =
          historyContext.selection.tierByMessage.get(message) ?? "low";
        historyContextTierDropsTotal.inc({ source: errorPrefix, tier });
      }
    }

    if (dropped > 0) {
      preferenceHistoryPrunedTotal.inc({ source: errorPrefix }, dropped);
      logger.info(`${errorPrefix}_history_pruned`, {
        dropped,
        kept: preparedUiMessages.length,
        keptTokens: historyContext.keptTokens,
        droppedTokens: historyContext.droppedTokens,
      });
    }

    const result = streamText({
      ...defaults,
      messages: modelMessages,
      abortSignal: request.signal,
      system: combinedSystem,
      onAbort: ({ steps }) => {
        logger.warn(`${errorPrefix}_stream_aborted`, {
          steps: steps.length,
        });
      },
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: preparedUiMessages,
      generateMessageId: generateId,
      consumeSseStream: consumeStream,
      messageMetadata: ({ part }) => {
        const metadata: Record<string, unknown> = {
          eventType: part.type,
        };
        const partWithId = part as { id?: string };
        if (typeof partWithId.id === "string") {
          metadata.streamId = partWithId.id;
        }
        if (part.type === "start") {
          metadata.createdAt = new Date().toISOString();
          metadata.model = modelId;
        }
        if (part.type === "finish") {
          const finishPart = part as {
            totalUsage?: {
              totalTokens?: number;
              promptTokens?: number;
              completionTokens?: number;
            };
          };
          metadata.totalTokens = finishPart.totalUsage?.totalTokens ?? null;
          metadata.promptTokens = finishPart.totalUsage?.promptTokens ?? null;
          metadata.completionTokens =
            finishPart.totalUsage?.completionTokens ?? null;
        }
        return metadata;
      },
      onFinish: async ({ isAborted, messages: streamedMessages }) => {
        if (!(userId && conversationId && streamedMessages?.length)) {
          return;
        }

        if (isAborted) {
          logger.warn(`${errorPrefix}_stream_aborted_on_finish`, {
            persisted: streamedMessages.length,
          });
        }

        const persisted = await persistMessages({
          conversationId,
          userId,
          messages: streamedMessages,
          existingMessageIds: persistedMessageIds,
        });
        scheduleRefresh(`${errorPrefix}_stream_complete`, persisted);
      },
    });

    if (conversationId) {
      response.headers.set("x-conversation-id", conversationId);
    }
    if (activationData) {
      response.headers.set(
        "x-mindscape-activation",
        JSON.stringify(activationData)
      );
    }

    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error(`${errorPrefix}_stream_error`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ error: `${errorPrefix}_stream_failed` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

type PersistPayload = {
  userId: string;
  conversationId: string;
  messages: UIMessage[];
  existingMessageIds: Set<string>;
};

async function persistMessages({
  userId,
  conversationId,
  messages,
  existingMessageIds,
}: PersistPayload): Promise<number> {
  let persisted = 0;
  for (const message of messages) {
    if (!message.id || existingMessageIds.has(message.id)) {
      continue;
    }
    try {
      await conversationRepo.createMessage(userId, conversationId, message);
      persisted += 1;
    } catch (error) {
      logger.warn("conversation_message_persist_failed", {
        conversationId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    existingMessageIds.add(message.id);
  }
  return persisted;
}
