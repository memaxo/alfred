/**
 * Alfred streaming domain types unified on AI SDK v6 primitives.
 */

import type {
  ModelMessage as AISDKModelMessage,
  UIMessage as AISDKUIMessage,
} from "ai";

/**
 * AI SDK v6 UI message type used across UI and persistence layers.
 */
export type UIMessage = AISDKUIMessage;

/**
 * AI SDK v6 model message type for language model invocations.
 */
export type ModelMessage = AISDKModelMessage;

/**
 * Client-side metadata for UI messages that should not be persisted upstream.
 */
export interface UIMessageClientMeta {
  status?: "sending" | "sent" | "error";
  createdAt?: string;
  completeAt?: string;
  agent?: "assistant" | "orchestrator";
  [key: string]: unknown;
}

export type UIMessageActionStatus =
  | "pending"
  | "running"
  | "completed"
  | "error";

export interface UIMessageAction {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  status: UIMessageActionStatus;
  result?: unknown;
  error?: string;
  updatedAt?: string;
}

/**
 * Stream events for AI SDK v6 structured streams.
 * Mirroring @ai-sdk/core definitions for shared usage.
 */
export type StreamEvent =
  | { _: "text-delta"; textDelta: string }
  | {
      _: "tool-call";
      toolCallId: string;
      toolName: string;
      args: unknown;
    }
  | {
      _: "tool-result";
      toolCallId: string;
      result: unknown;
      isError?: boolean;
    }
  | { _: "reasoning"; textDelta: string }
  | {
      _: "finish";
      finishReason: string;
      usage?: { promptTokens: number; completionTokens: number };
    }
  | { _: "error"; error: unknown };
