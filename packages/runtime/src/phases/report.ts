import type { WorkflowEvent } from "@alfred/type/plan";

import type { ExecutionContext } from "../context";
import type { RuntimeInput } from "../types";

export interface ReportArtifacts {
  events: WorkflowEvent[];
  scanContext?: ExecutionContext | null;
  planSummary?: string | null;
  startedAt?: number;
}

export async function* executeReportPhase(
  input: RuntimeInput,
  signal: AbortSignal,
  artifacts: ReportArtifacts
): AsyncGenerator<WorkflowEvent, void, void> {
  yield { _: "notice", message: "reporting_started" } as WorkflowEvent;

  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  const reportEvent = buildReportEvent(input, artifacts);
  yield reportEvent;

  yield { _: "notice", message: "reporting_completed" } as WorkflowEvent;
}

function buildReportEvent(
  input: RuntimeInput,
  artifacts: ReportArtifacts
): WorkflowEvent {
  const events = Array.isArray(artifacts.events) ? artifacts.events : [];
  const kindOf = (event: WorkflowEvent): unknown =>
    (event as { _?: unknown; type?: unknown })._ ?? (event as any).type;
  const errors = events.filter((event) => kindOf(event) === "error");
  const toolCalls = events.filter((event) => kindOf(event) === "tool-call");
  const toolResults = events.filter((event) => kindOf(event) === "tool-result");
  const durationMs = artifacts.startedAt
    ? Math.max(0, Date.now() - artifacts.startedAt)
    : undefined;

  const formattedErrors = errors.slice(-3).map((event) => {
    const message = (event as { message?: string }).message ?? "unknown";
    return { message };
  });

  const contextFiles = artifacts.scanContext?.bundle?.files.length ?? 0;
  const contextTokens = artifacts.scanContext?.totalTokens ?? 0;

  const summary = {
    requirement: input.requirement,
    status: errors.length > 0 ? "failed" : "completed",
    durationMs,
    totals: {
      events: events.length,
      notices: events.filter((event) => kindOf(event) === "notice").length,
      errors: errors.length,
    },
    tools: {
      calls: toolCalls.length,
      results: toolResults.length,
    },
    context: {
      files: contextFiles,
      tokens: contextTokens,
    },
    planSummary: artifacts.planSummary?.slice(0, 2000),
    errors: formattedErrors,
  };

  return {
    _: "report",
    summary,
  } as WorkflowEvent;
}
