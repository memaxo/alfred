/**
 * AI SDK v6 Adapter
 * 
 * Maps AI SDK streamText events to WorkflowEvent types.
 * All property names verified against AI SDK v6 specification.
 */

import { streamText } from "ai";
import type { LanguageModel } from "ai";
import type { WorkflowEvent } from "@alfred/type/plan";

export type StreamOptions = {
  model: LanguageModel;
  messages: any[];
  tools?: Record<string, any>;
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
export class AISDKAdapter {
  /**
   * Stream AI generation and map events to WorkflowEvent
   */
  async *stream(options: StreamOptions): AsyncGenerator<WorkflowEvent, void, void> {
    const result = streamText({
      model: options.model,
      messages: options.messages,
      tools: options.tools,
      abortSignal: options.abortSignal,
      system: options.system,
      temperature: options.temperature,
      // maxTokens and maxSteps will be used when integrating AI SDK properly
    });

    for await (const event of result.fullStream) {
      const mapped = this.mapEvent(event);
      if (mapped) {
        yield mapped;
      }
    }
  }

  /**
   * Map AI SDK event to WorkflowEvent
   * 
   * Uses correct AI SDK v6 property names from audit.
   */
  private mapEvent(sdkEvent: any): WorkflowEvent | null {
    switch (sdkEvent.type) {
      case "text-delta":
        return {
          type: "text-delta",
          id: sdkEvent.id, // Required id field for tracking text blocks
          delta: sdkEvent.delta, // CORRECT: was sdkEvent.textDelta in v4
        } as WorkflowEvent;

      case "tool-call":
        return {
          type: "tool-call",
          toolCallId: sdkEvent.toolCallId, // Keep consistent property naming
          toolName: sdkEvent.toolName,
          input: sdkEvent.input, // CORRECT: was sdkEvent.args
        } as WorkflowEvent;

      case "tool-result":
        return {
          type: "tool-result",
          toolCallId: sdkEvent.toolCallId, // Keep consistent property naming
          toolName: sdkEvent.toolName,
          input: sdkEvent.input, // Include input that was passed
          output: sdkEvent.output, // CORRECT: was sdkEvent.result
        } as WorkflowEvent;

      case "finish":
        return {
          type: "finish",
          finishReason: sdkEvent.finishReason,
          usage: sdkEvent.usage,
        } as WorkflowEvent;

      case "error":
        return {
          type: "error",
          message:
            sdkEvent.error instanceof Error
              ? sdkEvent.error.message
              : String(sdkEvent.error),
        } as WorkflowEvent;

      // Additional event types (forward if WorkflowEvent supports them)
      case "text-start":
      case "text-end":
      case "reasoning":
      case "reasoning-start":
      case "reasoning-delta":
      case "reasoning-end":
      case "start-step":
      case "finish-step":
      case "abort":
        // Forward these events - can be handled by UI incrementally
        return sdkEvent as WorkflowEvent;

      default:
        // Ignore unknown events
        return null;
    }
  }
}

