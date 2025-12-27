/**
 * Codex event processor
 *
 * Processes thread events from Codex execution and returns structured data.
 * Pure function that transforms events without side effects.
 */

import type { ThreadEvent, ThreadItem } from "@alfred/codex";
import {
  extractReasoningText,
  type ReasoningAccumulator,
} from "../shared/index.js";
import type { AlfredCodexEvent, CodexArtifactSummary } from "./definition.js";

export type EventProcessorContext = {
  outputDebug: boolean;
  reasoningAccumulator: ReasoningAccumulator;
};

export type ProcessedEvent = {
  alfredEvents: AlfredCodexEvent[];
  outputChunk?: string;
  reasoning?: string;
  threadId?: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  };
  artifacts?: CodexArtifactSummary[];
  turnStarted?: boolean;
  turnCompleted?: boolean;
  error?: { message: string; stage: string };
};

function processItemCompleted(
  item: ThreadItem,
  _ctx: EventProcessorContext
): ProcessedEvent {
  const alfredEvents: AlfredCodexEvent[] = [];
  const result: ProcessedEvent = { alfredEvents };

  switch (item.type) {
    case "reasoning": {
      const reasoningText = extractReasoningText(item);
      if (reasoningText) {
        const timestamp = Date.now();
        result.reasoning = reasoningText;
        alfredEvents.push({
          type: "thought",
          content: reasoningText,
          timestamp,
        });
      }
      break;
    }
    case "command_execution": {
      const output = item.aggregated_output;
      const status: "running" | "completed" | "failed" =
        item.status === "in_progress"
          ? "running"
          : item.status === "failed"
            ? "failed"
            : "completed";

      alfredEvents.push({
        type: "command",
        command: item.command,
        status,
      });

      if (output) {
        result.outputChunk = output;
        alfredEvents.push({
          type: "output",
          content: output,
        });
      }
      break;
    }
    case "agent_message": {
      const text = item.text;
      if (text) {
        result.outputChunk = text;
        alfredEvents.push({
          type: "output",
          content: text,
        });
      }
      break;
    }
    case "file_change": {
      const changes = item.changes;
      const artifacts: CodexArtifactSummary[] = [];
      for (const change of changes) {
        if (!change?.path) {
          continue;
        }
        artifacts.push({
          path: change.path,
          kind: change.kind,
        });
        alfredEvents.push({
          type: "artifact",
          path: change.path,
          kind: "file",
        });
      }
      result.artifacts = artifacts;
      break;
    }
    default:
      break;
  }

  return result;
}

export function processThreadEvent(
  event: ThreadEvent,
  ctx: EventProcessorContext
): ProcessedEvent {
  const result: ProcessedEvent = { alfredEvents: [] };

  switch (event.type) {
    case "thread.started": {
      const id = event.thread_id;
      if (typeof id === "string" && id.length > 0) {
        result.threadId = id;
      }
      break;
    }
    case "turn.started": {
      result.turnStarted = true;
      break;
    }
    case "turn.completed": {
      result.turnCompleted = true;
      const usage = event.usage;
      if (usage) {
        result.tokenUsage = {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cachedInputTokens: usage.cached_input_tokens,
        };
      }
      break;
    }
    case "turn.failed": {
      const detail = event.error?.message ?? "codex_turn_failed";
      result.error = { message: detail, stage: "turn.failed" };
      break;
    }
    case "error": {
      const detail = event.message ?? "codex_stream_error";
      result.error = { message: detail, stage: "stream.error" };
      break;
    }
    case "item.completed": {
      return processItemCompleted(event.item, ctx);
    }
    default:
      break;
  }

  return result;
}

export function formatArtifactReasoning(
  artifactSummaries: CodexArtifactSummary[]
): string {
  const details = artifactSummaries
    .map((artifact) => {
      const kind = artifact.kind || "file";
      const path = artifact.path || "(unknown)";
      return `- ${kind} ${path}`;
    })
    .join("\n");
  return `artifacts_collected (${artifactSummaries.length}):\n${details}`;
}
