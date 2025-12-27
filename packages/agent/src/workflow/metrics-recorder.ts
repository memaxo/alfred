import { coerceNonEmptyString, coerceRecord } from "../utils/coerce";
import {
  multiAgentAgentDurationSeconds,
  multiAgentErrorsTotal,
  multiAgentTasksTotal,
  multiAgentWavesTotal,
} from "./metrics";

type AgentData = {
  role?: string;
  status?: string;
  stuck?: boolean;
  durationSeconds?: number;
};

export function recordMultiAgentEvent(event: unknown): void {
  const evt = coerceRecord(event);
  const kind = coerceNonEmptyString(evt.kind);

  if (kind === "data-subtasks" && Array.isArray(evt.data)) {
    multiAgentTasksTotal.inc({ status: "created" }, evt.data.length || 1);
    return;
  }

  if (kind === "data-wave-plan") {
    multiAgentWavesTotal.inc({ status: "started" });
    return;
  }

  if (kind === "wave-result") {
    const data = coerceRecord(evt.data);
    const status = coerceNonEmptyString(data.status) ?? "completed";
    multiAgentWavesTotal.inc({ status });

    const agents: AgentData[] = Array.isArray(data.agents)
      ? (data.agents as Record<string, unknown>[]).map(coerceRecord)
      : [];

    for (const agent of agents) {
      recordAgentOutcome(agent);
    }
    return;
  }

  if (kind === "wave-aborted") {
    multiAgentErrorsTotal.inc({ kind: "wave_aborted" });
    return;
  }

  if (kind === "merge-conflict") {
    multiAgentErrorsTotal.inc({ kind: "merge_conflict" });
    return;
  }

  if (kind === "merge-plan") {
    multiAgentTasksTotal.inc({ status: "merged" });
    return;
  }

  if (kind === "review-plan") {
    multiAgentTasksTotal.inc({ status: "review" });
    return;
  }

  if (
    kind === "merge-agent-result" ||
    kind === "review-agent-result" ||
    kind === "conflict-agent-result" ||
    kind === "conflict-resolution-result" ||
    kind === "review-exec-result"
  ) {
    const data = coerceRecord(evt.data);
    const role = coerceNonEmptyString(data.role) ?? "worker";
    const rawStatus = coerceNonEmptyString(data.status);
    const outcome: "ok" | "error" | "stuck" =
      rawStatus === "stuck" ? "stuck" : rawStatus === "failed" ? "error" : "ok";

    const dur = data.durationSeconds;
    if (typeof dur === "number" && Number.isFinite(dur) && dur >= 0) {
      multiAgentAgentDurationSeconds.observe({ role, outcome }, dur);
    }

    if (outcome !== "ok") {
      const errorKind = mapKindToErrorMetric(kind);
      multiAgentErrorsTotal.inc({ kind: errorKind });
    }
    return;
  }
}

function recordAgentOutcome(agent: AgentData): void {
  const role = coerceNonEmptyString(agent.role) ?? "worker";
  const rawStatus = coerceNonEmptyString(agent.status);
  const outcome: "ok" | "error" | "stuck" =
    rawStatus === "stuck" || agent.stuck
      ? "stuck"
      : rawStatus === "failed"
        ? "error"
        : "ok";

  const dur = agent.durationSeconds;
  if (typeof dur === "number" && Number.isFinite(dur) && dur >= 0) {
    multiAgentAgentDurationSeconds.observe({ role, outcome }, dur);
  }

  if (outcome !== "ok") {
    multiAgentErrorsTotal.inc({ kind: "stuck_agent" });
  }
}

function mapKindToErrorMetric(kind: string): string {
  switch (kind) {
    case "merge-agent-result":
      return "merge_failed";
    case "review-agent-result":
      return "review_failed";
    case "conflict-agent-result":
      return "merge_conflict_analysis_failed";
    case "conflict-resolution-result":
      return "merge_conflict_resolution_failed";
    default:
      return "review_exec_failed";
  }
}
