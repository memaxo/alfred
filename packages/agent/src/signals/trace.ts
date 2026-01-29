/**
 * Signals trace collector (fact-only).
 *
 * This module collects sanitized, privacy-preserving facts for the Signals judge.
 * It must NOT classify or detect signals; that is the job of the LLM judge.
 */

import type { ModelMessage, UIMessage } from "@alfred/type";

import { redactObject, redactSecrets } from "../utils/redaction.js";

export interface TraceToolCall {
  readonly toolName: string;
  readonly toolCallId?: string;
  readonly status: "success" | "error" | "rejected" | "cancelled";
  readonly durationMs?: number;
  readonly error?: string;
}

export interface TraceContextOp {
  readonly kind: "add" | "remove";
  /** Abstract label: do NOT include raw filenames/paths. */
  readonly resource: string;
}

export interface SignalsTrace {
  readonly sessionId: string;
  readonly workflowId?: string;
  readonly agentType: "assistant" | "orchestrator" | "voice";
  readonly stepNumber: number;
  readonly elapsedMs: number;
  readonly messages: readonly TraceMessage[];
  readonly toolCalls: readonly TraceToolCall[];
  readonly contextOps: readonly TraceContextOp[];
  readonly errors: readonly string[];
  readonly budget?: { costUsd?: number; maxCostUsd?: number };
}

export interface TraceMessage {
  readonly role: string;
  readonly summary: string;
}

export interface TraceBuilderOptions {
  readonly sessionId: string;
  readonly workflowId?: string;
  readonly agentType: SignalsTrace["agentType"];
  readonly stepNumber: number;
  readonly elapsedMs: number;
  readonly messages: readonly (UIMessage | ModelMessage)[];
  readonly toolCalls?: readonly TraceToolCall[];
  readonly contextOps?: readonly TraceContextOp[];
  readonly errors?: readonly string[];
  readonly budget?: SignalsTrace["budget"];
  /** Max messages included (default: 12). */
  readonly maxMessages?: number;
  /** Max chars per message summary (default: 240). */
  readonly maxMessageChars?: number;
}

export function buildSignalsTrace(opts: TraceBuilderOptions): SignalsTrace {
  const maxMessages = opts.maxMessages ?? 12;
  const maxMessageChars = opts.maxMessageChars ?? 240;

  const tail = opts.messages.slice(-maxMessages);
  const messages = tail.map((m) => ({
    role: String((m as { role?: unknown }).role ?? "unknown"),
    summary: summarizeMessage(m, maxMessageChars),
  }));

  return redactObject({
    sessionId: opts.sessionId,
    workflowId: opts.workflowId,
    agentType: opts.agentType,
    stepNumber: opts.stepNumber,
    elapsedMs: opts.elapsedMs,
    messages,
    toolCalls: opts.toolCalls ?? [],
    contextOps: opts.contextOps ?? [],
    errors: (opts.errors ?? []).map((e) => redactSecrets(e).slice(0, 400)),
    budget: opts.budget,
  }) as SignalsTrace;
}

function summarizeMessage(
  message: UIMessage | ModelMessage,
  maxChars: number
): string {
  // Never include full tool args/results or large content. We only produce a
  // compact abstract summary for the judge.
  const parts =
    (message as UIMessage).parts ??
    (((message as ModelMessage as unknown as { content?: unknown }).content ??
      []) as unknown[]);

  const textParts: string[] = [];
  for (const part of parts) {
    if (part && typeof part === "object" && "type" in part) {
      const t = (part as { type?: unknown }).type;
      if (
        t === "text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        textParts.push((part as { text: string }).text);
      }
      if (t === "tool-call") {
        const { toolName } = part as { toolName?: unknown };
        if (typeof toolName === "string") {
          textParts.push(`[tool-call:${toolName}]`);
        }
      }
      if (t === "tool-result") {
        const { toolName } = part as { toolName?: unknown };
        if (typeof toolName === "string") {
          textParts.push(`[tool-result:${toolName}]`);
        }
      }
    }
  }

  const combined = textParts.join(" ").trim();
  const redacted = redactSecrets(combined);
  if (redacted.length <= maxChars) {
    return redacted;
  }
  return `${redacted.slice(0, Math.max(0, maxChars - 1))}…`;
}
