/**
 * AI SDK v6 Adapter
 *
 * Maps AI SDK streamText events to WorkflowEvent types.
 * All property names verified against AI SDK v6 specification.
 */

import type { WorkflowEvent } from "@alfred/type/plan";
import type { UIMessage } from "@alfred/type/stream";
import { limitUiMessages } from "@alfred/type/history";
import { buildPreferenceSystemPrompt } from "@alfred/agent/preference/prompt";
import type { LanguageModel, Tool } from "ai";
import {
  convertToModelMessages,
  pruneMessages,
  streamText,
  validateUIMessages,
} from "ai";
import {
  runtimeAiEventsTotal,
  runtimeAiSdkCallsTotal,
  runtimeAiSdkDurationSeconds,
} from "../metrics";
import { logger } from "../utils/logger";

export type StreamOptions = {
  model: LanguageModel;
  messages: UIMessage[];
  tools?: Record<string, Tool>;
  maxSteps?: number;
  abortSignal?: AbortSignal;
  system?: string;
  temperature?: number;
  maxTokens?: number;
};

/**
 * AISDKAdapter wraps AI SDK streamText and maps events to WorkflowEvent
 *
 * Property names match AI SDK v6 specification:
 * - text-delta: { id, delta } (NOT textDelta)
 * - tool-call: { toolCallId, toolName, input } (NOT args)
 * - tool-result: { toolCallId, toolName, input, output } (NOT result)
 */
type AdapterInit = {
  runId?: string;
  userId?: string;
};

export class AISDKAdapter {
  private readonly runId?: string;
  private readonly userId?: string;

  constructor();
  constructor(runId?: string);
  constructor(init?: AdapterInit);
  constructor(arg?: string | AdapterInit) {
    if (typeof arg === "string") {
      this.runId = arg;
      this.userId = undefined;
      return;
    }

    this.runId = arg?.runId;
    this.userId = arg?.userId;
  }

  /**
   * Stream AI generation and map events to WorkflowEvent
   */
  async *stream(
    options: StreamOptions
  ): AsyncGenerator<WorkflowEvent, void, void> {
    const modelId = this.getModelId(options.model);
    const startTime = Date.now();
    const stopAi = runtimeAiSdkDurationSeconds.startTimer({ model: modelId });

    runtimeAiSdkCallsTotal.inc({ model: modelId, status: "started" });

    logger.info("runtime_ai_sdk_call_start", {
      runId: this.runId,
      model: modelId,
    });

    try {
      const preferencePrompt = await this.buildPreferencePrompt(options);
      const systemPrompt = mergeSystemPrompts(options.system, preferencePrompt);

      const inputMessages = Array.isArray(options.messages)
        ? options.messages
        : [];
      const limitedMessages = limitUiMessages(inputMessages);
      const dropped = inputMessages.length - limitedMessages.length;
      if (dropped > 0) {
        logger.info("runtime_history_pruned", {
          runId: this.runId,
          dropped,
          kept: limitedMessages.length,
        });
      }

      const validatedMessages = (await validateUIMessages({
        messages: limitedMessages,
        tools: options.tools as Parameters<typeof validateUIMessages>[0]["tools"],
      })) as UIMessage[];
      const modelMessages = convertToModelMessages(validatedMessages);
      const prunedMessages = pruneMessages({
        messages: modelMessages,
        reasoning: "before-last-message",
        toolCalls: "before-last-2-messages",
        emptyMessages: "remove",
      });

      const result = streamText({
        model: options.model,
        messages: prunedMessages,
        tools: options.tools,
        abortSignal: options.abortSignal,
        system: systemPrompt,
        temperature: options.temperature,
        // maxTokens and maxSteps will be used when integrating AI SDK properly
      });

      for await (const event of result.fullStream) {
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
        runId: this.runId,
        model: modelId,
        durationMs,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      runtimeAiSdkCallsTotal.inc({ model: modelId, status: "failed" });
      stopAi();

      logger.error("runtime_ai_sdk_error", {
        runId: this.runId,
        model: modelId,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      });

      throw error;
    }
  }

  /**
   * Extract model ID from LanguageModel object
   */
  private getModelId(model: LanguageModel): string {
    if (typeof model === "string") {
      return model;
    }

    if (typeof model === "object" && model !== null) {
      const maybeId = (model as { modelId?: unknown }).modelId;
      if (typeof maybeId === "string") {
        return maybeId;
      }
    }

    return "unknown";
  }

  /**
   * Map AI SDK event to WorkflowEvent
   *
   * Uses correct AI SDK v6 property names from audit.
   */
  private mapEvent(sdkEvent: AISDKStreamEvent): WorkflowEvent | null {
    if (isTextDeltaEvent(sdkEvent)) {
      return {
        type: "text-delta",
        id: sdkEvent.id,
        delta: sdkEvent.delta,
      };
    }

    if (isToolCallEvent(sdkEvent)) {
      return {
        type: "tool-call",
        toolCallId: sdkEvent.toolCallId,
        toolName: sdkEvent.toolName,
        input: sdkEvent.input,
      };
    }

    if (isToolResultEvent(sdkEvent)) {
      return {
        type: "tool-result",
        toolCallId: sdkEvent.toolCallId,
        toolName: sdkEvent.toolName,
        input: sdkEvent.input,
        output: sdkEvent.output,
      };
    }

    if (isFinishEvent(sdkEvent)) {
      return {
        type: "finish",
        finishReason: sdkEvent.finishReason,
        usage: sdkEvent.usage,
      };
    }

    if (isErrorEvent(sdkEvent)) {
      return {
        type: "error",
        message:
          sdkEvent.error instanceof Error
            ? sdkEvent.error.message
            : String(sdkEvent.error),
      };
    }

    if (forwardedEventTypes.has(sdkEvent.type)) {
      return sdkEvent as WorkflowEvent;
    }

    return null;
  }

  private async buildPreferencePrompt(
    options: StreamOptions
  ): Promise<string | undefined> {
    if (!this.userId) {
      return undefined;
    }

    try {
      const prompt = await buildPreferenceSystemPrompt(this.userId, {
        toolNames: options.tools ? Object.keys(options.tools) : undefined,
        conversationType: "workflow",
      });
      return prompt || undefined;
    } catch (error) {
      logger.warn("runtime_preference_prompt_failed", {
        runId: this.runId,
        userId: this.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }
}

type BaseEvent = { type: string; [key: string]: unknown };

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
