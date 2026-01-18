import { buildPreferenceSystemPrompt } from "@alfred/agent/preference/prompt";
import { triggerPreferenceRefresh } from "@alfred/api/preference/refresh";
import {
  createConnection,
  getConnectionCount,
  removeConnection,
  updateConnectionActivity,
} from "@alfred/api/utils/sse-connections";
import { auth } from "@alfred/auth";
import * as conversationRepo from "@alfred/db/repo/conversation";
import { buildHistoryContext, getHistoryBudgetDefaults } from "@alfred/history";
import { logger } from "@alfred/logger";
import { classifyAiSdkError } from "@alfred/type/aierror";
import { routerMessageSchema, uiMessageSchema } from "@alfred/type/stream.zod";
import { isTextPart } from "@alfred/ui/chat/parts";
import { consumeStream, generateId, streamText, type UIMessage } from "ai";
import { z } from "zod";

const requestSchema = z
  .object({
    // Accept unknown[] for compatibility with clients that haven't fully
    // migrated to AI SDK v6 UIMessage yet (e.g. legacy {role, content} messages).
    // We normalize to UIMessage below.
    messages: z.array(z.unknown()).min(1),
    conversationId: z.string().min(1).optional(),
  })
  .passthrough();

type NormalizedMessagesResult =
  | { ok: true; messages: UIMessage[] }
  | { ok: false; issues: z.ZodIssue[] };

function normalizeUiRole(
  role: unknown
): "assistant" | "system" | "user" | null {
  if (role === "tool") {
    // UIMessage roles do not include "tool"; represent legacy tool messages as assistant text.
    return "assistant";
  }
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }
  return null;
}

function normalizeUiMessages(input: unknown[]): NormalizedMessagesResult {
  const out: UIMessage[] = [];
  const issues: z.ZodIssue[] = [];

  for (const raw of input) {
    const direct = uiMessageSchema.safeParse(raw);
    if (direct.success) {
      out.push(direct.data as UIMessage);
      continue;
    }

    // Legacy router format: { role, content }
    const legacy = routerMessageSchema.safeParse(raw);
    if (legacy.success) {
      const role = normalizeUiRole(legacy.data.role);
      if (!role) {
        issues.push(...direct.error.issues);
        continue;
      }
      out.push({
        id: generateId(),
        role,
        parts: [{ type: "text", text: legacy.data.content }],
      });
      continue;
    }

    // Common client shape: { role, parts?, content?, id? }
    if (typeof raw === "object" && raw !== null) {
      const msg = raw as Record<string, unknown>;
      const role = msg.role;
      const id = typeof msg.id === "string" ? msg.id : generateId();

      // Allow { role, content: string } as fallback.
      const content = msg.content;
      if (typeof role === "string" && typeof content === "string") {
        const normalizedRole = normalizeUiRole(role);
        if (!normalizedRole) {
          issues.push(...direct.error.issues);
          continue;
        }
        const candidate = uiMessageSchema.safeParse({
          id,
          role: normalizedRole,
          parts: [{ type: "text", text: content }],
          metadata: msg.metadata,
        });
        if (candidate.success) {
          out.push(candidate.data as UIMessage);
          continue;
        }
        issues.push(...candidate.error.issues);
        continue;
      }

      // Allow { role, parts } without id.
      if (typeof role === "string" && Array.isArray(msg.parts)) {
        const normalizedRole = normalizeUiRole(role);
        if (!normalizedRole) {
          issues.push(...direct.error.issues);
          continue;
        }
        const candidate = uiMessageSchema.safeParse({
          id,
          role: normalizedRole,
          parts: msg.parts,
          metadata: msg.metadata,
        });
        if (candidate.success) {
          out.push(candidate.data as UIMessage);
          continue;
        }
        issues.push(...candidate.error.issues);
        continue;
      }
    }

    issues.push(...direct.error.issues);
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, messages: out };
}

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

  const requestStartTime = performance.now();
  let connectionId: string | null = null;
  let userId: string | null = null;
  let firstChunkSent = false;
  let closeMcp: (() => Promise<void>) | null = null;
  let sseConnectionsCurrentRef:
    | typeof import("@alfred/api/metrics")["sseConnectionsCurrent"]
    | null = null;

  try {
    const metricsPkg = "@alfred/api/metrics";
    const {
      historyContextSelectionDurationSeconds,
      historyContextTierDropsTotal,
      historyContextTokensTotal,
      preferenceHistoryPrunedTotal,
      preferencePromptFailuresTotal,
      preferencePromptInjectionsTotal,
      sseConnectionRateLimitHitsTotal,
      sseConnectionsCurrent: sseConnectionsCurrentMetric,
      sseFirstChunkLatencySeconds,
    } = (await import(
      /* @vite-ignore */
      metricsPkg
    )) as typeof import("@alfred/api/metrics");
    sseConnectionsCurrentRef = sseConnectionsCurrentMetric;
    const sseConnectionsCurrent = sseConnectionsCurrentMetric;

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
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const normalized = normalizeUiMessages(parsed.data.messages);
    if (!normalized.ok) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          issues: normalized.issues,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const messages = normalized.messages;
    const persistedMessageIds = new Set<string>();

    const session = await auth.api.getSession({ headers: request.headers });
    userId = session?.user?.id ?? null;
    if (!userId) {
      return new Response(JSON.stringify({ error: "session_required" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    // Check connection limits and rate limiting
    const connectionResult = createConnection(userId, errorPrefix);
    if (!connectionResult.allowed) {
      sseConnectionRateLimitHitsTotal
        .labels(errorPrefix, connectionResult.reason ?? "unknown")
        .inc();
      return new Response(
        JSON.stringify({
          error: "rate_limit_exceeded",
          reason: connectionResult.reason,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Retry-After": "60",
          },
        }
      );
    }
    connectionId = connectionResult.connectionId;
    // Update connection count metric (global count)
    const globalConnectionCount = getConnectionCount();
    sseConnectionsCurrent.labels(errorPrefix).set(globalConnectionCount);

    let conversationId =
      typeof parsed.data.conversationId === "string"
        ? parsed.data.conversationId
        : undefined;

    if (!conversationId) {
      try {
        const conversation = await conversationRepo.createConversation(userId);
        conversationId = conversation.id;
      } catch (error) {
        logger.warn("conversation_create_failed", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const scheduleRefresh = (reason: string, persisted: number) => {
      if (!userId || persisted === 0) {
        return;
      }
      triggerPreferenceRefresh(userId, { reason });
    };

    if (conversationId) {
      // If we have messages, we should ensure the DB matches the incoming state.
      // This handles cases like message editing or regeneration where the client
      // might have removed some messages from the end of the history.
      if (messages.length > 0) {
        const lastMessage = messages.at(-1);
        if (lastMessage?.id) {
          try {
            await conversationRepo.deleteMessagesAfter(
              userId,
              conversationId,
              lastMessage.id
            );
          } catch (error) {
            logger.warn("conversation_delete_after_failed", {
              userId,
              conversationId,
              messageId: lastMessage.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

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
        logger.warn("api_stream_context_analysis_failed", {
          prefix: errorPrefix,
          userId: userId ?? undefined,
          error: String(e),
        });
      }
    }

    const defaults = getDefaults();
    const tools = defaults.tools ?? {};
    const stopWhen = defaults.stopWhen;
    const prepareStep = defaults.prepareStep;
    let mergedTools = tools;

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
        logger.warn("api_stream_preference_prompt_failed", {
          prefix: errorPrefix,
          userId: userId ?? undefined,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const combinedSystem = [preferencePrompt, contextSystem]
      .filter(Boolean)
      .join("\n\n");

    try {
      const { loadMcpTools } = await import("@alfred/agent/mcp");
      const mcp = await loadMcpTools(userId, request.signal);
      if (Object.keys(mcp.tools).length > 0) {
        mergedTools = { ...tools, ...mcp.tools };
      }
      closeMcp = mcp.close;
    } catch (error) {
      logger.warn("api_stream_mcp_tools_failed", {
        prefix: errorPrefix,
        userId: userId ?? undefined,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const { getModelForRole } = await import("@alfred/agent/selector");
    const role = errorPrefix === "orchestrator" ? "orchestrator" : "chat";
    const selection = await getModelForRole(role, { userId });
    const modelId = selection.modelKey;
    const stopHistoryTimer = historyContextSelectionDurationSeconds.startTimer({
      source: errorPrefix,
    });
    const historyContext = await buildHistoryContext({
      messages,
      modelId,
      system: combinedSystem,
      tools: mergedTools,
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
      logger.info("api_stream_history_pruned", {
        prefix: errorPrefix,
        dropped,
        kept: preparedUiMessages.length,
        keptTokens: historyContext.keptTokens,
        droppedTokens: historyContext.droppedTokens,
      });
    }

    const telemetry =
      process.env.AI_TELEMETRY === "1"
        ? {
            experimental_telemetry: {
              isEnabled: true,
              functionId: `web.${errorPrefix}.stream`,
              recordInputs: false,
              recordOutputs: false,
            },
          }
        : {};

    const abortSignal = request.signal.aborted ? undefined : request.signal;
    const result = streamText({
      model: selection.model,
      tools: mergedTools,
      stopWhen,
      prepareStep,
      ...telemetry,
      messages: modelMessages,
      abortSignal,
      system: combinedSystem,
      onFinish: async () => {
        await closeMcp?.();
      },
      onAbort: ({ steps }) => {
        logger.warn("api_stream_aborted", {
          prefix: errorPrefix,
          userId: userId ?? undefined,
          steps: steps.length,
        });
        void closeMcp?.();
        if (connectionId && userId) {
          removeConnection(connectionId);
          connectionId = null;
          // Update connection count metric (global count)
          const globalConnectionCount = getConnectionCount();
          sseConnectionsCurrent.labels(errorPrefix).set(globalConnectionCount);
        }
      },
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: preparedUiMessages,
      generateMessageId: generateId,
      consumeSseStream: consumeStream,
      messageMetadata: ({ part }) => {
        // Track first chunk latency
        if (
          !firstChunkSent &&
          (part.type === "text-delta" || isTextPart(part))
        ) {
          const textContent =
            typeof part === "object" && part !== null && "text" in part
              ? (part as { text?: string }).text
              : undefined;
          if (textContent !== undefined) {
            firstChunkSent = true;
            const firstChunkLatency =
              (performance.now() - requestStartTime) / 1000;
            sseFirstChunkLatencySeconds
              .labels(errorPrefix)
              .observe(firstChunkLatency);
            if (connectionId) {
              updateConnectionActivity(connectionId);
            }
          }
        }

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
        // Cleanup connection
        if (connectionId && userId) {
          removeConnection(connectionId);
          connectionId = null;
          // Update connection count metric (global count)
          const globalConnectionCount = getConnectionCount();
          sseConnectionsCurrent.labels(errorPrefix).set(globalConnectionCount);
        }

        if (!(userId && conversationId && streamedMessages?.length)) {
          return;
        }

        if (isAborted) {
          logger.warn("api_stream_aborted_on_finish", {
            prefix: errorPrefix,
            userId: userId ?? undefined,
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
    response.headers.set("x-model", modelId);
    response.headers.set("Cache-Control", "no-store");
    if (activationData) {
      response.headers.set(
        "x-mindscape-activation",
        JSON.stringify(activationData)
      );
    }

    return response;
  } catch (error) {
    // Cleanup connection on error
    if (connectionId && userId) {
      removeConnection(connectionId);
      connectionId = null;
      // Update connection count metric (global count)
      const globalConnectionCount = getConnectionCount();
      sseConnectionsCurrentRef?.labels(errorPrefix).set(globalConnectionCount);
    }
    void closeMcp?.();

    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    const classified = classifyAiSdkError(error);

    logger.error("api_stream_error", {
      prefix: errorPrefix,
      userId: userId ?? undefined,
      safeCode: classified.safeCode,
      kind: classified.kind,
      retryable: classified.retryable,
      ...classified.log,
    });

    return new Response(
      JSON.stringify({
        error: classified.safeCode,
        message: classified.safeMessage,
        retryable: classified.retryable,
      }),
      {
        status: classified.httpStatus,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
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
      existingMessageIds.add(message.id);
    } catch (error) {
      logger.warn("conversation_message_persist_failed", {
        conversationId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return persisted;
}
