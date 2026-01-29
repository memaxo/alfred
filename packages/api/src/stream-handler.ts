import { buildPreferenceSystemPrompt } from "@alfred/agent/preference/prompt";
import { auth } from "@alfred/auth";
import * as conversationRepo from "@alfred/db/repo/conversation";
import {
  buildHistoryContext,
  calculateBudget,
  getOrCreateTracker,
} from "@alfred/history";
import { logger } from "@alfred/logger";
import { classifyAiSdkError } from "@alfred/type/aierror";
import { routerMessageSchema, uiMessageSchema } from "@alfred/type/stream.zod";
import { consumeStream, generateId, streamText, type UIMessage } from "ai";
import { z } from "zod";

import { triggerPreferenceRefresh } from "./preference/refresh";
import {
  createConnection,
  getConnectionCount,
  removeConnection,
  updateConnectionActivity,
} from "./utils/sse-connections";

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
      const { role } = msg;
      const id = typeof msg.id === "string" ? msg.id : generateId();

      // Allow { role, content: string } as fallback.
      const { content } = msg;
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

function isTextPartLike(part: unknown): part is { type: "text"; text: string } {
  return (
    !!part &&
    typeof part === "object" &&
    (part as { type?: unknown }).type === "text" &&
    typeof (part as { text?: unknown }).text === "string"
  );
}

type StreamArgs = Parameters<typeof streamText>[0];
type AgentDefaults = Pick<
  StreamArgs,
  "model" | "tools" | "stopWhen" | "prepareStep"
>;
type GetDefaultsFn = () => AgentDefaults;
interface ContextAnalysisResult {
  system?: string;
  activation?: Record<string, unknown>;
}
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
    | (typeof import("./metrics"))["sseConnectionsCurrent"]
    | null = null;

  try {
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
    } = await import("./metrics");
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

    const { messages } = normalized;
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
    ({ connectionId } = connectionResult);
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
      } catch (error) {
        logger.warn("api_stream_context_analysis_failed", {
          prefix: errorPrefix,
          userId: userId ?? undefined,
          error: String(error),
        });
      }
    }

    const defaults = getDefaults();
    const tools = defaults.tools ?? {};
    const { stopWhen } = defaults;
    const { prepareStep } = defaults;
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
    // Calculate dynamic budget based on model
    const calculatedBudget = calculateBudget({ modelId });

    // Create tracker for the chat session
    const chatId =
      conversationId ?? `stream-${userId ?? "anonymous"}-${Date.now()}`;
    const tracker = getOrCreateTracker({
      sessionId: chatId,
      modelId,
      budgetUsd: parsed.data.maxCostUsd as number | undefined,
    });

    const stopHistoryTimer = historyContextSelectionDurationSeconds.startTimer({
      source: errorPrefix,
    });
    const historyContext = await buildHistoryContext({
      messages,
      modelId,
      system: combinedSystem,
      tools: mergedTools,
      source: errorPrefix,
      budget: {
        maxContextTokens: calculatedBudget.effectiveContextTokens,
        historyRatio: calculatedBudget.historyRatio,
        minSystemReserveTokens: calculatedBudget.systemReserveTokens,
        minHeadroomTokens: calculatedBudget.headroomTokens,
        reservedToolingTokens: calculatedBudget.toolingReserveTokens,
      },
    });
    stopHistoryTimer();

    const preparedUiMessages = historyContext.uiMessages;
    const { modelMessages } = historyContext;
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
    const signalsEnabled = process.env.ALFRED_SIGNALS === "1";

    let lastSignalsSummary:
      | {
          friction: readonly {
            type: string;
            severity: string;
            timing: string;
          }[];
          delight: readonly { type: string }[];
          interventions: readonly { action: string; timing: string }[];
        }
      | undefined;

    let toolsForStream = mergedTools;
    let prepareStepForStream = prepareStep;

    if (signalsEnabled) {
      const signalsToolCalls: import("@alfred/agent/signals/trace").TraceToolCall[] =
        [];

      let signalsMetrics:
        | {
            latency: (typeof import("@alfred/metrics"))["signalsJudgeLatencySeconds"];
            detected: (typeof import("@alfred/metrics"))["signalsDetectedTotal"];
            interventions: (typeof import("@alfred/metrics"))["signalsInterventionsTotal"];
          }
        | undefined;

      toolsForStream = Object.fromEntries(
        Object.entries(mergedTools).map(([name, tool]) => {
          const t = tool as any;
          if (!t || typeof t !== "object" || typeof t.execute !== "function") {
            return [name, tool];
          }
          return [
            name,
            {
              ...t,
              execute: async (input: unknown, ctx: any) => {
                const start = performance.now();
                try {
                  const out = await t.execute(input, ctx);
                  signalsToolCalls.push({
                    toolName: name,
                    toolCallId:
                      ctx && typeof ctx === "object" && "toolCallId" in ctx
                        ? String((ctx as any).toolCallId)
                        : undefined,
                    status: "success",
                    durationMs: performance.now() - start,
                  });
                  return out;
                } catch (error) {
                  signalsToolCalls.push({
                    toolName: name,
                    toolCallId:
                      ctx && typeof ctx === "object" && "toolCallId" in ctx
                        ? String((ctx as any).toolCallId)
                        : undefined,
                    status: "error",
                    durationMs: performance.now() - start,
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                  throw error;
                }
              },
            },
          ];
        })
      ) as typeof mergedTools;

      const basePrepareStep = prepareStep;
      prepareStepForStream = async (args: any) => {
        const base = (await basePrepareStep?.(args)) ?? {};
        const nextMessages = (base as any).messages ?? args.messages;
        const stepNumber =
          typeof args?.stepNumber === "number"
            ? args.stepNumber
            : typeof args?.step === "number"
              ? args.step
              : 0;

        try {
          if (!signalsMetrics) {
            const m = await import("@alfred/metrics");
            signalsMetrics = {
              latency: m.signalsJudgeLatencySeconds,
              detected: m.signalsDetectedTotal,
              interventions: m.signalsInterventionsTotal,
            };
          }

          const [
            { getClassificationModel },
            { judgeSignals },
            { buildSignalsTrace },
          ] = await Promise.all([
            import("@alfred/agent/selector"),
            import("@alfred/agent/signals/judge"),
            import("@alfred/agent/signals/trace"),
          ]);

          const sel = await getClassificationModel({
            userId: userId ?? undefined,
          });
          const stopTimer = signalsMetrics.latency.startTimer({
            surface: "chat",
            model: sel.modelKey ?? "unknown",
          });
          const trace = buildSignalsTrace({
            sessionId: chatId,
            agentType:
              errorPrefix === "orchestrator" ? "orchestrator" : "assistant",
            stepNumber,
            elapsedMs: performance.now() - requestStartTime,
            // model messages at this step (sanitized in trace builder)
            messages: nextMessages,
            toolCalls: signalsToolCalls,
            errors: signalsToolCalls
              .filter(
                (c) => c.status === "error" && typeof c.error === "string"
              )
              .map((c) => c.error as string),
            budget: {
              maxCostUsd: parsed.data.maxCostUsd as number | undefined,
            } as any,
          });

          const judged = await judgeSignals(
            { trace: trace as unknown as Record<string, unknown> },
            { model: sel.model, abortSignal: abortSignal }
          );
          stopTimer();

          lastSignalsSummary = {
            friction: judged.friction.map((s) => ({
              type: s.type,
              severity: s.severity,
              timing: s.timing,
            })),
            delight: judged.delight.map((s) => ({ type: s.type })),
            interventions: judged.interventions.map((i) => ({
              action: i.action,
              timing: i.timing,
            })),
          };

          for (const s of judged.friction) {
            signalsMetrics.detected.inc({
              surface: "chat",
              kind: "friction",
              type: s.type,
              severity: s.severity,
              timing: s.timing,
            });
          }
          for (const s of judged.delight) {
            signalsMetrics.detected.inc({
              surface: "chat",
              kind: "delight",
              type: s.type,
              severity: "na",
              timing: "na",
            });
          }
          for (const i of judged.interventions) {
            signalsMetrics.interventions.inc({
              surface: "chat",
              action: i.action,
              timing: i.timing,
            });
          }

          const intervention = judged.interventions[0];
          if (intervention?.message) {
            const injected = {
              role: "system",
              content: [
                {
                  type: "text",
                  text: `<signals_intervention step="${stepNumber}">\n${intervention.message}\n</signals_intervention>`,
                },
              ],
            };
            return { ...base, messages: [...nextMessages, injected] };
          }
        } catch (error) {
          logger.warn("signals_prepare_step_failed", {
            prefix: errorPrefix,
            userId: userId ?? undefined,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return { ...base, messages: nextMessages };
      };
    }

    const result = streamText({
      model: selection.model,
      tools: toolsForStream,
      stopWhen,
      prepareStep: prepareStepForStream,
      ...telemetry,
      messages: modelMessages,
      abortSignal,
      system: combinedSystem,
      onFinish: async (result) => {
        await closeMcp?.();

        // Track token usage and cost
        try {
          const usage = result.usage as
            | {
                inputTokens?: number;
                outputTokens?: number;
                cachedInputTokens?: number;
                reasoningTokens?: number;
              }
            | undefined;

          if (usage && conversationId) {
            const latencyMs = performance.now() - requestStartTime;
            tracker.record({
              modelId,
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
              cachedTokens: usage.cachedInputTokens ?? 0,
              reasoningTokens: usage.reasoningTokens ?? 0,
              latencyMs,
            });
          }
        } catch (error) {
          // Don't fail the request if tracking fails
          logger.error("stream_cost_tracking_failed", {
            error: error instanceof Error ? error.message : String(error),
            conversationId,
          });
        }
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
          (part.type === "text-delta" || isTextPartLike(part))
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
        if (part.type === "finish" && lastSignalsSummary) {
          metadata.signals = lastSignalsSummary;
        }
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

interface PersistPayload {
  userId: string;
  conversationId: string;
  messages: UIMessage[];
  existingMessageIds: Set<string>;
}

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
