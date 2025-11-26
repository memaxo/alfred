import type { WorkflowEvent } from "@alfred/type/plan";
import type { ExecutionContext } from "../context";
import type { RuntimeInput } from "../types";

export type ReportArtifacts = {
  events: WorkflowEvent[];
  scanContext?: ExecutionContext | null;
  planSummary?: string | null;
  startedAt?: number;
};

export async function* executeReportPhase(
  input: RuntimeInput,
  signal: AbortSignal,
  artifacts: ReportArtifacts
): AsyncGenerator<WorkflowEvent, void, void> {
  yield { type: "notice", message: "reporting_started" } as WorkflowEvent;

  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  const reportEvent = buildReportEvent(input, artifacts);
  yield reportEvent;

  yield { type: "notice", message: "reporting_completed" } as WorkflowEvent;
}

function buildReportEvent(
  input: RuntimeInput,
  artifacts: ReportArtifacts
): WorkflowEvent {
  const events = Array.isArray(artifacts.events) ? artifacts.events : [];
  const errors = events.filter((event) => event.type === "error");
  const toolCalls = events.filter((event) => event.type === "tool-call");
  const toolResults = events.filter((event) => event.type === "tool-result");
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
      notices: events.filter((event) => event.type === "notice").length,
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
    type: "report",
    summary,
  } as WorkflowEvent;
}
