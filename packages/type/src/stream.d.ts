/**
 * Alfred streaming domain types unified on AI SDK v6 primitives.
 */
import type { ModelMessage as AISDKModelMessage, UIMessage as AISDKUIMessage } from "ai";
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
export type UIMessageClientMeta = {
    status?: "sending" | "sent" | "error";
    createdAt?: string;
    completeAt?: string;
    agent?: "assistant" | "orchestrator";
    [key: string]: unknown;
};
export type UIMessageActionStatus = "pending" | "running" | "completed" | "error";
export type UIMessageAction = {
    id: string;
    name: string;
    args?: Record<string, unknown>;
    status: UIMessageActionStatus;
    result?: unknown;
    error?: string;
    updatedAt?: string;
};
//# sourceMappingURL=stream.d.ts.map