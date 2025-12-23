import { setTimeout as delay } from "node:timers/promises";
import {
  commentOnLinearIssue,
  emitLinearActivity,
  extractIssueIdFromSession,
  setLinearCancelled,
  setLinearCompleted,
  setLinearDelegate,
  setLinearSessionExternalUrl,
  setLinearStarted,
} from "@alfred/agent/orchestrator/linear";
import type { ReviewCheckStatus } from "@alfred/agent/workflow/review-gate";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import { logger } from "@alfred/logger";

function resolveExternalUrlBase(): string | null {
  return (
    process.env.PUBLIC_URL ??
    process.env.VITE_APP_URL ??
    process.env.APP_URL ??
    null
  );
}

function workflowUrlFor(id: string | null): string | null {
  const externalUrlBase = resolveExternalUrlBase();
  if (!(id && externalUrlBase)) {
    return null;
  }
  const normalized = externalUrlBase.endsWith("/")
    ? externalUrlBase.slice(0, -1)
    : externalUrlBase;
  return `${normalized}/workflow/${id}`;
}

function resolveIssueId(
  linear: NonNullable<WorkflowInputPayload["linear"]>
): string | null {
  if (linear.issueId && linear.issueId.length > 0) {
    return linear.issueId;
  }
  if (linear.sessionId) {
    return extractIssueIdFromSession(linear.sessionId);
  }
  return null;
}

export async function bootstrapLinearSession(args: {
  runId: string;
  requirement: string;
  linear: NonNullable<WorkflowInputPayload["linear"]>;
  authz: string;
}): Promise<void> {
  const { runId, requirement, linear, authz } = args;
  try {
    const thoughtPromise = emitLinearActivity("thought", {
      sessionId: linear.sessionId as string,
      space: linear.space,
      authz,
      body: `Starting workflow: ${requirement}`,
    }).catch((error) => {
      logger.warn("linear_thought_activity_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { ok: false };
    });

    await Promise.race([
      thoughtPromise,
      delay(9000).then(() => {
        logger.warn("linear_thought_activity_timeout", { runId });
        return { ok: false };
      }),
    ]);

    const issueId = resolveIssueId(linear);
    if (!issueId) {
      logger.warn("linear_issue_id_missing", { runId });
      return;
    }

    setLinearDelegate({
      space: linear.space,
      issueId,
      authz,
    }).catch((error: unknown) => {
      logger.warn("linear_delegate_setup_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    setLinearStarted({
      space: linear.space,
      issueId,
      authz,
    }).catch((error: unknown) => {
      logger.warn("linear_started_setup_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    const url = workflowUrlFor(runId);
    if (url) {
      setLinearSessionExternalUrl(
        linear.sessionId as string,
        linear.space,
        authz,
        url
      ).catch((error: unknown) => {
        logger.warn("linear_external_url_setup_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } else {
      logger.warn("linear_external_url_setup_missing_base", { runId });
    }
  } catch (error) {
    logger.warn("linear_bootstrap_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function safeFinalizeLinearSuccess(args: {
  runId: string;
  finalMessage: string | null;
  reviewChecks: ReviewCheckStatus[];
  linear: NonNullable<WorkflowInputPayload["linear"]>;
  authz: string;
}): Promise<void> {
  const { runId, finalMessage, reviewChecks, linear, authz } = args;
  const issueId = resolveIssueId(linear);
  if (!issueId) {
    logger.warn("linear_issue_id_missing", { runId });
    return;
  }

  try {
    await setLinearCompleted({
      space: linear.space,
      issueId,
      authz,
    });

    const commentBody = buildLinearCompletionComment({
      runId,
      finalMessage,
      reviewChecks,
      workflowUrl: workflowUrlFor(runId),
    });

    await commentOnLinearIssue({
      space: linear.space,
      issueId,
      authz,
      body: commentBody,
    });
  } catch (error) {
    logger.warn("linear_finalize_success_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function safeFinalizeLinearFailure(args: {
  runId: string;
  reason: string;
  linear: NonNullable<WorkflowInputPayload["linear"]>;
  authz: string;
}): Promise<void> {
  const { runId, reason, linear, authz } = args;
  const issueId = resolveIssueId(linear);
  if (!issueId) {
    logger.warn("linear_issue_id_missing", { runId });
    return;
  }

  try {
    await setLinearCancelled({
      space: linear.space,
      issueId,
      authz,
    });

    const commentBody = buildLinearFailureComment({
      runId,
      reason,
      workflowUrl: workflowUrlFor(runId),
    });

    await commentOnLinearIssue({
      space: linear.space,
      issueId,
      authz,
      body: commentBody,
    });
  } catch (error) {
    logger.warn("linear_finalize_failure_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function emitLinearErrorActivity(args: {
  runId: string;
  message: string;
  linear: NonNullable<WorkflowInputPayload["linear"]>;
  authz: string;
}): void {
  const { runId, message, linear, authz } = args;
  emitLinearActivity("error", {
    sessionId: linear.sessionId as string,
    space: linear.space,
    authz,
    body: message,
  }).catch((error) => {
    logger.warn("linear_activity_emission_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

function buildLinearCompletionComment(args: {
  runId: string;
  finalMessage: string | null;
  reviewChecks: ReviewCheckStatus[];
  workflowUrl: string | null;
}): string {
  const lines: string[] = [
    `Workflow run ${args.runId} completed successfully.`,
  ];

  if (args.workflowUrl) {
    lines.push(`Run details: ${args.workflowUrl}`);
  }

  if (args.finalMessage && args.finalMessage.trim().length > 0) {
    lines.push(`Summary: ${args.finalMessage.trim()}`);
  }

  if (args.reviewChecks.length > 0) {
    lines.push("Review checks:");
    for (const check of args.reviewChecks) {
      const attemptInfo =
        check.attempts > 0 ? ` (attempt ${check.attempts})` : "";
      lines.push(`- ${check.type}: ${check.status}${attemptInfo}`);
    }
  } else {
    lines.push("Review checks: not required.");
  }

  return lines.join("\n");
}

function buildLinearFailureComment(args: {
  runId: string;
  reason: string;
  workflowUrl: string | null;
}): string {
  const lines: string[] = [`Workflow run ${args.runId} failed.`];
  if (args.workflowUrl) {
    lines.push(`Run details: ${args.workflowUrl}`);
  }
  const trimmedReason = args.reason?.trim();
  if (trimmedReason) {
    lines.push(`Reason: ${trimmedReason}`);
  }
  lines.push("Review the run log, address the failure, and re-run when ready.");
  return lines.join("\n");
}
