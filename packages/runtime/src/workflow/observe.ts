import type { ReviewGate } from "@alfred/agent/workflow/review-gate";
import type { WorkflowEvent } from "@alfred/type";

import {
  multiAgentAgentDurationSeconds,
  multiAgentErrorsTotal,
  multiAgentTasksTotal,
  multiAgentWavesTotal,
} from "@alfred/agent/workflow/metrics";

import type { ReasonTrace } from "./provenance";

function coerceRecord(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function coerceNonEmptyString(val: unknown): string | null {
  return typeof val === "string" && val.length > 0 ? val : null;
}

function maybeCaptureReasoning(args: {
  event: WorkflowEvent;
  reasonTraces: ReasonTrace[];
}): void {
  if (args.event._ !== "reasoning") {
    return;
  }
  const payload = coerceRecord(args.event);
  const text =
    coerceNonEmptyString(payload.text) ??
    coerceNonEmptyString(payload.reasoning);
  if (!text) {
    return;
  }
  args.reasonTraces.push({ text, timestamp: Date.now() });
}

/**
 * Observability hooks for multi-agent workflow streams.
 * Must never throw; all errors are swallowed.
 */
export function observeEvent(args: {
  event: WorkflowEvent;
  reviewGate: ReviewGate;
  reasonTraces: ReasonTrace[];
}): void {
  try {
    const evt = coerceRecord(args.event);
    const kind = coerceNonEmptyString(evt.kind);
    switch (kind) {
      case "data-subtasks": {
        if (Array.isArray(evt.data)) {
          multiAgentTasksTotal.inc({ status: "created" }, evt.data.length || 1);
        }
        break;
      }
      case "data-wave-plan": {
        multiAgentWavesTotal.inc({ status: "started" });
        break;
      }
      case "wave-result": {
        const data = coerceRecord(evt.data);
        const status = coerceNonEmptyString(data.status) ?? "completed";
        multiAgentWavesTotal.inc({ status });

        const agents: {
          role?: string;
          status?: string;
          stuck?: boolean;
          durationSeconds?: number;
        }[] = Array.isArray(data.agents)
          ? (data.agents as Record<string, unknown>[]).map(coerceRecord)
          : [];

        for (const agent of agents) {
          const role = coerceNonEmptyString(agent.role) ?? "worker";
          const rawStatus = coerceNonEmptyString(agent.status);
          const outcome: "ok" | "error" | "stuck" =
            rawStatus === "stuck" || agent.stuck
              ? "stuck"
              : (rawStatus === "failed"
                ? "error"
                : "ok");

          const dur = agent.durationSeconds;
          if (typeof dur === "number" && Number.isFinite(dur) && dur >= 0) {
            multiAgentAgentDurationSeconds.observe({ role, outcome }, dur);
          }

          if (outcome !== "ok") {
            multiAgentErrorsTotal.inc({ kind: "stuck_agent" });
          }
        }
        break;
      }
      case "wave-aborted": {
        multiAgentErrorsTotal.inc({ kind: "wave_aborted" });
        break;
      }
      case "merge-conflict": {
        multiAgentErrorsTotal.inc({ kind: "merge_conflict" });
        break;
      }
      case "merge-plan": {
        multiAgentTasksTotal.inc({ status: "merged" });
        break;
      }
      case "review-plan": {
        multiAgentTasksTotal.inc({ status: "review" });
        args.reviewGate.applyPlan(coerceRecord(evt.data));
        break;
      }
      case "review-check": {
        const check = coerceRecord(evt.data);
        const evidenceRaw = check.output ?? check.error ?? check.evidence;
        let evidence: string | undefined;
        if (typeof evidenceRaw === "string") {
          evidence = evidenceRaw;
        } else if (evidenceRaw !== undefined && evidenceRaw !== null) {
          try {
            evidence = JSON.stringify(evidenceRaw);
          } catch {
            evidence = String(evidenceRaw);
          }
        }

        args.reviewGate.recordCheck({
          id: coerceNonEmptyString(check.id) ?? undefined,
          type: coerceNonEmptyString(check.type) ?? undefined,
          status: coerceNonEmptyString(check.status) ?? undefined,
          attempt:
            typeof check.attempt === "number" && Number.isFinite(check.attempt)
              ? check.attempt
              : undefined,
          evidence,
        });
        break;
      }
      case "merge-agent-result":
      case "review-agent-result":
      case "conflict-agent-result":
      case "conflict-resolution-result":
      case "review-exec-result": {
        const data = coerceRecord(evt.data);
        const role = coerceNonEmptyString(data.role) ?? "worker";
        const rawStatus = coerceNonEmptyString(data.status);
        const outcome: "ok" | "error" | "stuck" =
          rawStatus === "stuck"
            ? "stuck"
            : (rawStatus === "failed"
              ? "error"
              : "ok");
        const dur = data.durationSeconds;
        if (typeof dur === "number" && Number.isFinite(dur) && dur >= 0) {
          multiAgentAgentDurationSeconds.observe({ role, outcome }, dur);
        }
        if (outcome !== "ok") {
          const errorKind =
            kind === "merge-agent-result"
              ? "merge_failed"
              : kind === "review-agent-result"
                ? "review_failed"
                : kind === "conflict-agent-result"
                  ? "merge_conflict_analysis_failed"
                  : kind === "conflict-resolution-result"
                    ? "merge_conflict_resolution_failed"
                    : "review_exec_failed";
          multiAgentErrorsTotal.inc({ kind: errorKind });
        }
        break;
      }
      default: {
        break;
      }
    }
  } catch {
    // Metrics must never break streaming; ignore metric errors.
  }

  try {
    maybeCaptureReasoning({
      event: args.event,
      reasonTraces: args.reasonTraces,
    });
  } catch {
    // Reasoning capture must never break streaming.
  }
}
