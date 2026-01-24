import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";

import { coerceNonEmptyString, coerceRecord } from "../utils/coerce";
import { type ReviewCheckStatus, ReviewGate } from "./review-gate";

type ReviewGateState = {
  checks: ReviewCheckStatus[];
  planInitialized: boolean;
  planRequired: boolean;
  minimumRequired: number;
};

export type ReviewEscalationSummary = {
  reason?: string;
  attempts?: number;
  fixerAttempts?: number;
  plan?: string;
  failures?: Array<{
    command?: string;
    output?: string;
    error?: string;
    checkId?: string;
  }>;
  relevantFiles?: string[];
  summary?: string;
};

export class ReviewGateManager {
  private readonly gate = new ReviewGate();
  private escalation: ReviewEscalationSummary | null = null;
  private escalationMetricRecorded = false;

  async restoreFromRun(runId: string): Promise<void> {
    try {
      const workflowRun = await workflowRepo.getRun(runId);
      if (workflowRun?.stateData && typeof workflowRun.stateData === "object") {
        const stateData = workflowRun.stateData as Record<string, unknown>;
        if (stateData.reviewGate && typeof stateData.reviewGate === "object") {
          this.gate.restore(stateData.reviewGate as ReviewGateState);
        }
        if (stateData.reviewEscalation) {
          this.escalation =
            stateData.reviewEscalation as ReviewEscalationSummary | null;
        }
      }
    } catch (error) {
      logger.warn("failed_to_restore_review_gate", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  requireAtLeast(count: number): void {
    this.gate.requireAtLeast(count);
  }

  applyPlan(data: unknown): void {
    this.gate.applyPlan(coerceRecord(data));
  }

  recordCheck(data: unknown): void {
    const check = coerceRecord(data);
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

    this.gate.recordCheck({
      id: coerceNonEmptyString(check.id) ?? undefined,
      type: coerceNonEmptyString(check.type) ?? undefined,
      status: coerceNonEmptyString(check.status) ?? undefined,
      attempt:
        typeof check.attempt === "number" && Number.isFinite(check.attempt)
          ? check.attempt
          : undefined,
      evidence,
    });
  }

  recordEscalation(data: unknown): { metricKind: string } | null {
    const evt = coerceRecord(data);
    this.escalation = {
      reason: coerceNonEmptyString(evt.reason) ?? undefined,
      attempts:
        typeof evt.attempts === "number" ? (evt.attempts as number) : undefined,
      fixerAttempts:
        typeof evt.fixerAttempts === "number"
          ? (evt.fixerAttempts as number)
          : undefined,
      plan: coerceNonEmptyString(evt.plan) ?? undefined,
      failures: Array.isArray(evt.failures)
        ? (evt.failures as ReviewEscalationSummary["failures"])
        : undefined,
      relevantFiles: Array.isArray(evt.relevantFiles)
        ? (evt.relevantFiles as string[])
        : undefined,
      summary: coerceNonEmptyString(evt.summary) ?? undefined,
    };

    if (!this.escalationMetricRecorded) {
      this.escalationMetricRecorded = true;
      const metricKind = formatEscalationMetricKind(
        coerceNonEmptyString(evt.reason) ?? undefined
      );
      return { metricKind };
    }
    return null;
  }

  isSatisfied(): boolean {
    return this.gate.isSatisfied();
  }

  summary(): ReviewCheckStatus[] {
    return this.gate.summary();
  }

  serialize(): {
    reviewGate: ReviewGateState;
    reviewEscalation: ReviewEscalationSummary | null;
  } {
    return {
      reviewGate: this.gate.serialize(),
      reviewEscalation: this.escalation,
    };
  }

  async persistState(runId: string): Promise<void> {
    try {
      const workflowRun = await workflowRepo.getRun(runId);
      const existingStateData =
        workflowRun?.stateData && typeof workflowRun.stateData === "object"
          ? (workflowRun.stateData as Record<string, unknown>)
          : {};
      await workflowRepo.updateRun(runId, {
        stateData: {
          ...existingStateData,
          ...this.serialize(),
        },
      });
    } catch (error) {
      logger.warn("failed_to_persist_review_gate", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getEscalationReason(): string | undefined {
    return this.escalationMetricRecorded ? this.escalation?.reason : undefined;
  }
}

function formatEscalationMetricKind(reason?: string): string {
  if (!reason) {
    return "review_escalated";
  }
  const slug = reason
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug.length > 0 ? `review_${slug}` : "review_escalated";
}
