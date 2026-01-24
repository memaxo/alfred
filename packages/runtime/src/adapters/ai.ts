/**
 * AI SDK v6 Adapter
 *
 * Maps AI SDK streamText events to WorkflowEvent types.
 * All property names verified against AI SDK v6 specification.
 */

import { buildPreferenceSystemPrompt } from "@alfred/agent/preference/prompt";
import { llmConcurrency, llmRateLimit } from "@alfred/agent/utils/rate-limiter";
import { buildHistoryContext } from "@alfred/history";
import { logger } from "@alfred/logger";
import { classifyAiSdkError, isAbortError } from "@alfred/type/aierror";
import { parseModelKey } from "@alfred/type/model";
import { type WorkflowEvent } from "@alfred/type/plan";
import { type UIMessage } from "@alfred/type/stream";
import { type LanguageModel, type Tool } from "ai";
import { stepCountIs, streamText, validateUIMessages } from "ai";

import {
  runtimeAiEventsTotal,
  runtimeAiSdkCallsTotal,
  runtimeAiSdkDurationSeconds,
  runtimeHistorySelectionDurationSeconds,
  runtimeHistoryTierDropsTotal,
  runtimeHistoryTokensTotal,
} from "../metrics";

export function normalizeModelLabel(raw: string): string {
  const v = raw.trim();
  if (v.length === 0) {
    return "unknown";
  }

  const normalized = v.includes(":") ? v.replace(":", "/") : v;
  try {
    // Ensure we emit provider/modelId style keys when possible.
    return parseModelKey(normalized).key;
  } catch {
    return normalized;
  }
}

export interface StreamOptions {
  model: LanguageModel;
  messages: UIMessage[];
  tools?: Record<string, Tool>;
  maxSteps?: number;
  abortSignal?: AbortSignal;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AiAdapter {
  stream(options: StreamOptions): AsyncGenerator<WorkflowEvent, void, void>;
}

/**
 * AISDKAdapter wraps AI SDK streamText and maps events to WorkflowEvent
 *
 * Property names match AI SDK v6 specification:
 * - text-delta: { id, delta } (NOT textDelta)
 * - tool-call: { toolCallId, toolName, input } (NOT args)
 * - tool-result: { toolCallId, toolName, input, output } (NOT result)
 */
interface AdapterInit {
  runId?: string;
  userId?: string;
  projectId?: string;
}

export class AISDKAdapter {
  private readonly runId?: string;
  private readonly userId?: string;
  private readonly projectId?: string;
  constructor(init?: AdapterInit | string);
  constructor(arg?: string | AdapterInit) {
    if (typeof arg === "string") {
      this.runId = arg;
      this.userId = undefined;
      this.projectId = undefined;
      return;
    }

    this.runId = arg?.runId;
    this.userId = arg?.userId;
    this.projectId = arg?.projectId;
  }

  /**
   * Stream AI generation and map events to WorkflowEvent
   */
  async *stream(
    options: StreamOptions
  ): AsyncGenerator<WorkflowEvent, void, void> {
    const modelId = this.getModelId(options.model);

    // Acquire concurrency semaphore and rate limit token
    await llmConcurrency.acquire();
    const tokenAcquired = await llmRateLimit.waitFor();

    if (!tokenAcquired) {
      llmConcurrency.release();
      throw new Error("LLM rate limit exceeded (timeout)");
    }

    const startTime = Date.now();
    const stopAi = runtimeAiSdkDurationSeconds.startTimer({ model: modelId });

    runtimeAiSdkCallsTotal.inc({ model: modelId, status: "started" });

    logger.info("runtime_ai_sdk_call_start", {
      model: modelId,
      runId: this.runId,
    });

    try {
      const preferencePrompt = await this.buildPreferencePrompt(options);
      const systemPrompt = mergeSystemPrompts(options.system, preferencePrompt);

      const inputMessages = Array.isArray(options.messages)
        ? options.messages
        : [];

      const validatedMessages = (await validateUIMessages({
        messages: inputMessages,
        tools: options.tools as Parameters<
          typeof validateUIMessages
        >[0]["tools"],
      })) as UIMessage[];

      // Use calculated budget based on model
      const { calculateBudget } = await import("@alfred/history");
      const calculatedBudget = calculateBudget({ modelId });

      const stopHistoryTimer =
        runtimeHistorySelectionDurationSeconds.startTimer();
      const historyContext = await buildHistoryContext({
        budget: {
          maxContextTokens: calculatedBudget.effectiveContextTokens,
          historyRatio: calculatedBudget.historyRatio,
          minSystemReserveTokens: calculatedBudget.systemReserveTokens,
          minHeadroomTokens: calculatedBudget.headroomTokens,
          reservedToolingTokens: calculatedBudget.toolingReserveTokens,
        },
        messages: validatedMessages,
        modelId,
        source: "runtime-ai-adapter",
        system: systemPrompt,
      });
      stopHistoryTimer();

      runtimeHistoryTokensTotal.inc(
        { action: "kept" },
        historyContext.keptTokens
      );
      runtimeHistoryTokensTotal.inc(
        { action: "dropped" },
        historyContext.droppedTokens
      );

      if (historyContext.selection.dropped.length > 0) {
        for (const message of historyContext.selection.dropped) {
          const tier =
            historyContext.selection.tierByMessage.get(message) ?? "low";
          runtimeHistoryTierDropsTotal.inc({ tier });
        }
      }

      if (historyContext.droppedMessages > 0) {
        logger.info("runtime_history_pruned", {
          dropped: historyContext.droppedMessages,
          droppedTokens: historyContext.droppedTokens,
          kept: historyContext.uiMessages.length,
          keptTokens: historyContext.keptTokens,
          runId: this.runId,
        });
      }

      const { modelMessages } = historyContext;

      const telemetry =
        process.env.AI_TELEMETRY === "1"
          ? {
              experimental_telemetry: {
                functionId: "runtime.stream",
                isEnabled: true,
                recordInputs: false,
                recordOutputs: false,
              },
            }
          : {};

      const result = streamText({
        model: options.model,
        messages: modelMessages,
        tools: options.tools,
        ...telemetry,
        abortSignal: options.abortSignal,
        system: systemPrompt,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        stopWhen: options.maxSteps ? stepCountIs(options.maxSteps) : undefined,
      });

      for await (const event of result.fullStream) {
        if (!event) {
          continue;
        }
        const sdkEvent = event as AISDKStreamEvent;
        // Track event types
        if (typeof sdkEvent.type === "string") {
          runtimeAiEventsTotal.inc({ event_type: sdkEvent.type });
        }

        const mapped = this.mapEvent(sdkEvent);
        if (mapped) {
          yield mapped;
        }
      }

      const durationMs = Date.now() - startTime;
      runtimeAiSdkCallsTotal.inc({ model: modelId, status: "completed" });
      stopAi();

      logger.info("runtime_ai_sdk_call_complete", {
        durationMs,
        model: modelId,
        runId: this.runId,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      runtimeAiSdkCallsTotal.inc({ model: modelId, status: "failed" });
      stopAi();

      if (isAbortError(error)) {
        logger.warn("runtime_ai_sdk_aborted", {
          durationMs,
          model: modelId,
          runId: this.runId,
        });
        throw error;
      }

      const classified = classifyAiSdkError(error);

      logger.error("runtime_ai_sdk_error", {
        runId: this.runId,
        model: modelId,
        safeCode: classified.safeCode,
        kind: classified.kind,
        retryable: classified.retryable,
        ...classified.log,
        durationMs,
      });

      yield {
        _: "error",
        chunk: {
          code: classified.safeCode,
          message: classified.safeMessage,
          kind: classified.kind,
          retryable: classified.retryable,
        },
        message: classified.safeCode,
      } as WorkflowEvent;

      throw error;
    } finally {
      llmConcurrency.release();
    }
  }

  /**
   * Extract model ID from LanguageModel object
   */
  private getModelId(model: LanguageModel): string {
    const raw =
      typeof model === "string"
        ? model
        : typeof model === "object" && model !== null
          ? ((model as { id?: unknown }).id ??
            (model as { modelId?: unknown }).modelId)
          : undefined;

    if (typeof raw !== "string" || raw.trim().length === 0) {
      return "unknown";
    }

    return normalizeModelLabel(raw);
  }

  /**
   * Map AI SDK event to WorkflowEvent
   *
   * Uses correct AI SDK v6 property names from audit.
   */
  public mapEvent(sdkEvent: AISDKStreamEvent): WorkflowEvent | null {
    if (isTextDeltaEvent(sdkEvent)) {
      return {
        _: "text-delta",
        delta: sdkEvent.delta,
        id: sdkEvent.id,
      };
    }

    if (isToolCallEvent(sdkEvent)) {
      return {
        _: "tool-call",
        input: sdkEvent.input,
        toolCallId: sdkEvent.toolCallId,
        toolName: sdkEvent.toolName,
      };
    }

    if (isToolResultEvent(sdkEvent)) {
      return {
        _: "tool-result",
        input: sdkEvent.input,
        output: sdkEvent.output,
        toolCallId: sdkEvent.toolCallId,
        toolName: sdkEvent.toolName,
      };
    }

    if (isFinishEvent(sdkEvent)) {
      return {
        _: "finish",
        finishReason: sdkEvent.finishReason,
        usage: sdkEvent.usage,
      };
    }

    if (isErrorEvent(sdkEvent)) {
      return {
        _: "error",
        message:
          sdkEvent.error instanceof Error
            ? sdkEvent.error.message
            : String(sdkEvent.error || "unknown_error"),
      };
    }

    if (forwardedEventTypes.has(sdkEvent.type)) {
      // oxlint-disable noExplicitAny: Internal event mapping
      return { ...sdkEvent, _: sdkEvent.type } as any;
    }

    return null;
  }

  private async buildPreferencePrompt(
    options: StreamOptions
  ): Promise<string | undefined> {
    if (!this.userId) {
      return;
    }

    try {
      const prompt = await buildPreferenceSystemPrompt(this.userId, {
        conversationType: "workflow",
        projectId: this.projectId,
        toolNames: options.tools ? Object.keys(options.tools) : undefined,
      });
      return prompt || undefined;
    } catch (error) {
      logger.warn("runtime_preference_prompt_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId: this.runId,
        userId: this.userId,
      });
      return;
    }
  }
}

interface BaseEvent {
  type: string;
  [key: string]: unknown;
}

type TextDeltaEvent = BaseEvent & {
  type: "text-delta";
  id: string;
  delta: string;
};

type ToolCallEvent = BaseEvent & {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: unknown;
};

type ToolResultEvent = BaseEvent & {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  input: unknown;
  output: unknown;
};

type FinishEvent = BaseEvent & {
  type: "finish";
  finishReason?: string;
  usage?: Record<string, unknown>;
};

type ErrorEvent = BaseEvent & {
  type: "error";
  error: unknown;
};

type AISDKStreamEvent =
  | TextDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | FinishEvent
  | ErrorEvent
  | BaseEvent;

const forwardedEventTypes = new Set([
  "text-start",
  "text-end",
  "reasoning",
  "reasoning-start",
  "reasoning-delta",
  "reasoning-end",
  "start-step",
  "finish-step",
  "abort",
]);

function isTextDeltaEvent(event: AISDKStreamEvent): event is TextDeltaEvent {
  return (
    event.type === "text-delta" &&
    typeof event.id === "string" &&
    typeof event.delta === "string"
  );
}

function isToolCallEvent(event: AISDKStreamEvent): event is ToolCallEvent {
  return (
    event.type === "tool-call" &&
    typeof event.toolCallId === "string" &&
    typeof event.toolName === "string"
  );
}

function isToolResultEvent(event: AISDKStreamEvent): event is ToolResultEvent {
  return (
    event.type === "tool-result" &&
    typeof event.toolCallId === "string" &&
    typeof event.toolName === "string"
  );
}

function isFinishEvent(event: AISDKStreamEvent): event is FinishEvent {
  return event.type === "finish";
}

function isErrorEvent(event: AISDKStreamEvent): event is ErrorEvent {
  return event.type === "error" && "error" in event;
}

function mergeSystemPrompts(
  base?: string,
  preference?: string
): string | undefined {
  if (base && preference) {
    return `${base}\n\n${preference}`;
  }
  return preference || base || undefined;
}
