import { logger } from "@alfred/logger";
import { setTimeout as delay } from "node:timers/promises";

import type { ReviewCheckStatus } from "./review-gate";

import {
  commentOnLinearIssue,
  emitLinearActivity,
  extractIssueIdFromSession,
  setLinearCancelled,
  setLinearCompleted,
  setLinearDelegate,
  setLinearSessionExternalUrl,
  setLinearStarted,
} from "../orchestrator/linear";

type LinearConfig = {
  sessionId?: string;
  space: string;
  issueId?: string;
};

export class LinearActivityService {
  private readonly linear: LinearConfig;
  private readonly authz: string;
  private readonly runId: string;
  private failureNotified = false;

  constructor(linear: LinearConfig, authz: string, runId: string) {
    this.linear = linear;
    this.authz = authz;
    this.runId = runId;
  }

  private resolveIssueId(): string | null {
    if (this.linear.issueId && this.linear.issueId.length > 0) {
      return this.linear.issueId;
    }
    if (this.linear.sessionId) {
      return extractIssueIdFromSession(this.linear.sessionId);
    }
    return null;
  }

  async bootstrap(args: {
    requirement: string;
    workflowUrl: string | null;
  }): Promise<void> {
    const { requirement, workflowUrl } = args;
    try {
      const thoughtPromise = emitLinearActivity("thought", {
        sessionId: this.linear.sessionId as string,
        space: this.linear.space,
        authz: this.authz,
        body: `Starting workflow: ${requirement}`,
      }).catch((error) => {
        logger.warn("linear_thought_activity_failed", {
          runId: this.runId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false };
      });

      await Promise.race([
        thoughtPromise,
        delay(9000).then(() => {
          logger.warn("linear_thought_activity_timeout", { runId: this.runId });
          return { ok: false };
        }),
      ]);

      const issueId = this.resolveIssueId();
      if (!issueId) {
        logger.warn("linear_issue_id_missing", { runId: this.runId });
        return;
      }

      setLinearDelegate({
        space: this.linear.space,
        issueId,
        authz: this.authz,
      }).catch((error) => {
        logger.warn("linear_delegate_setup_failed", {
          runId: this.runId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      setLinearStarted({
        space: this.linear.space,
        issueId,
        authz: this.authz,
      }).catch((error) => {
        logger.warn("linear_started_setup_failed", {
          runId: this.runId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      if (workflowUrl) {
        setLinearSessionExternalUrl(
          this.linear.sessionId as string,
          this.linear.space,
          this.authz,
          workflowUrl
        ).catch((error) => {
          logger.warn("linear_external_url_setup_failed", {
            runId: this.runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      } else {
        logger.warn("linear_external_url_setup_missing_base", {
          runId: this.runId,
        });
      }
    } catch (error) {
      logger.warn("linear_bootstrap_failed", {
        runId: this.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async completeSuccess(args: {
    finalMessage: string | null;
    reviewChecks: ReviewCheckStatus[];
    workflowUrl: string | null;
  }): Promise<void> {
    const { finalMessage, reviewChecks, workflowUrl } = args;
    try {
      const issueId = this.resolveIssueId();
      if (!issueId) {
        throw new Error("linear_issue_id_missing");
      }

      await setLinearCompleted({
        space: this.linear.space,
        issueId,
        authz: this.authz,
      });

      const commentBody = buildLinearCompletionComment({
        runId: this.runId,
        finalMessage,
        reviewChecks,
        workflowUrl,
      });

      await commentOnLinearIssue({
        space: this.linear.space,
        issueId,
        authz: this.authz,
        body: commentBody,
      });
    } catch (error) {
      logger.warn("linear_success_finalization_failed", {
        runId: this.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async completeFailure(reason: string): Promise<void> {
    if (this.failureNotified) {
      return;
    }
    this.failureNotified = true;

    try {
      const issueId = this.resolveIssueId();
      if (!issueId) {
        throw new Error("linear_issue_id_missing");
      }

      await setLinearCancelled({
        space: this.linear.space,
        issueId,
        authz: this.authz,
      });

      const commentBody = buildLinearFailureComment({
        runId: this.runId,
        reason,
        workflowUrl: null,
      });

      await commentOnLinearIssue({
        space: this.linear.space,
        issueId,
        authz: this.authz,
        body: commentBody,
      });
    } catch (error) {
      logger.warn("linear_failure_notification_failed", {
        runId: this.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async emitError(message: string): Promise<void> {
    try {
      await emitLinearActivity("error", {
        sessionId: this.linear.sessionId as string,
        space: this.linear.space,
        authz: this.authz,
        body: message,
      });
    } catch (error) {
      logger.warn("linear_activity_emission_failed", {
        runId: this.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  get isFailureNotified(): boolean {
    return this.failureNotified;
  }
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
