// Minimal, dependency-free stubs to avoid cross-package coupling in agent.
// Full Linear integration lives in the API layer and DB repos.

import { logger } from "@alfred/logger";

import { withLinearRetry } from "./linear-retry";
import { getLinearMetrics } from "./linearmetrics";
import { toolTicket } from "./tool/ticket";

export type LinearActivityType = "thought" | "action" | "response" | "error";

export type LinearActivityParams = {
  sessionId: string;
  space: string;
  authz: string;
  title?: string;
  body?: string;
  parameter?: string;
  result?: string;
  ephemeral?: boolean;
};

export type LinearSessionParams = {
  space: string;
  issueId: string;
  authz: string;
  delegateId?: string;
};

export async function emitLinearActivity(
  type: LinearActivityType,
  params: LinearActivityParams
): Promise<{ ok: boolean; id?: string }> {
  const metrics = getLinearMetrics();
  const stopTimer = metrics.linearActivityDurationSeconds.startTimer({ type });
  try {
    const result = await withLinearRetry(
      async () => {
        const action = `activity.${type}` as
          | "activity.thought"
          | "activity.action"
          | "activity.response"
          | "activity.error";

        const input = {
          space: params.space,
          action,
          sessionId: params.sessionId,
          authz: params.authz,
          title: params.title,
          description: params.body,
          parameter: params.parameter,
          result: params.result,
          ephemeral: params.ephemeral,
        };

        const res = await toolTicket.execute({ input });
        return { ok: res.ok, id: res.id };
      },
      {
        category: type,
        logPrefix: "linear_activity",
        logContext: { type, sessionId: params.sessionId },
      }
    );
    metrics.linearActivityEmissionsTotal.inc({ type, status: "success" });
    return result;
  } catch (error) {
    metrics.linearActivityEmissionsTotal.inc({ type, status: "failure" });
    logger?.error?.("linear_activity_failed", {
      type,
      sessionId: params.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  } finally {
    stopTimer();
  }
}

export async function setLinearDelegate(
  params: LinearSessionParams
): Promise<void> {
  const metrics = getLinearMetrics();
  metrics.linearSessionOperationsTotal.inc({ operation: "delegate" });
  try {
    await withLinearRetry(
      async () => {
        const input = {
          space: params.space,
          action: "set-delegate" as const,
          issueId: params.issueId,
          delegateId: params.delegateId,
          authz: params.authz,
        };
        await toolTicket.execute({ input });
      },
      { category: "session", requireStartupBuffer: false }
    );
  } catch (error) {
    logger?.warn?.("linear_delegate_failed", {
      issueId: params.issueId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function setLinearStarted(
  params: LinearSessionParams
): Promise<{ stateId: string }> {
  const metrics = getLinearMetrics();
  metrics.linearSessionOperationsTotal.inc({ operation: "state" });
  try {
    const result = await withLinearRetry(
      () => {
        const input = {
          space: params.space,
          action: "set-started" as const,
          issueId: params.issueId,
          authz: params.authz,
        };
        return toolTicket.execute({ input });
      },
      { category: "session", requireStartupBuffer: false }
    );
    const resolved = result as { ok: boolean; id?: string; stateId?: string };
    return { stateId: resolved.stateId ?? "state_unknown" };
  } catch (error) {
    logger?.warn?.("linear_started_failed", {
      issueId: params.issueId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { stateId: "state_stub" };
  }
}

export async function setLinearCompleted(
  params: LinearSessionParams
): Promise<{ stateId: string }> {
  const metrics = getLinearMetrics();
  metrics.linearSessionOperationsTotal.inc({ operation: "completed" });
  try {
    const result = await withLinearRetry(
      () => {
        const input = {
          space: params.space,
          action: "set-completed" as const,
          issueId: params.issueId,
          authz: params.authz,
        };
        return toolTicket.execute({ input });
      },
      { category: "session", requireStartupBuffer: false }
    );
    const resolved = result as { ok: boolean; id?: string; stateId?: string };
    return { stateId: resolved.stateId ?? "state_unknown" };
  } catch (error) {
    logger?.warn?.("linear_completed_failed", {
      issueId: params.issueId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function commentOnLinearIssue(params: {
  space: string;
  issueId: string;
  authz: string;
  body: string;
}): Promise<void> {
  const metrics = getLinearMetrics();
  metrics.linearSessionOperationsTotal.inc({ operation: "comment" });
  try {
    await withLinearRetry(
      async () => {
        const input = {
          space: params.space,
          action: "comment" as const,
          issueId: params.issueId,
          description: params.body,
          authz: params.authz,
        };
        await toolTicket.execute({ input });
      },
      { category: "session", requireStartupBuffer: false }
    );
  } catch (error) {
    logger?.warn?.("linear_comment_failed", {
      issueId: params.issueId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function setLinearSessionExternalUrl(
  sessionId: string,
  space: string,
  authz: string,
  url: string
): Promise<void> {
  const metrics = getLinearMetrics();
  metrics.linearSessionOperationsTotal.inc({ operation: "external_url" });
  try {
    await withLinearRetry(
      async () => {
        const input = {
          space,
          action: "session.external-url" as const,
          sessionId,
          url,
          authz,
        };
        await toolTicket.execute({ input });
      },
      { category: "session", requireStartupBuffer: false }
    );
  } catch (error) {
    logger?.warn?.("linear_external_url_failed", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function setLinearCancelled(
  params: LinearSessionParams
): Promise<{ stateId: string }> {
  const metrics = getLinearMetrics();
  metrics.linearSessionOperationsTotal.inc({ operation: "cancelled" });
  try {
    const result = await withLinearRetry(
      () => {
        const input = {
          space: params.space,
          action: "set-cancelled" as const,
          issueId: params.issueId,
          authz: params.authz,
        };
        return toolTicket.execute({ input });
      },
      { category: "session", requireStartupBuffer: false }
    );
    const resolved = result as { ok: boolean; id?: string; stateId?: string };
    return { stateId: resolved.stateId ?? "state_unknown" };
  } catch (error) {
    logger?.warn?.("linear_cancelled_failed", {
      issueId: params.issueId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function extractIssueIdFromSession(sessionId: string): string | null {
  // Explicitly handle null, undefined, and non-strings
  if (sessionId === null || sessionId === undefined) {
    return null;
  }
  if (typeof sessionId !== "string") {
    return null;
  }

  const trimmed = sessionId.trim();
  if (trimmed.length === 0 || trimmed.length > 255) {
    return null;
  }

  return trimmed;
}

export async function createLinearBlockingRelation(params: {
  space: string;
  blockingIssueId: string;
  blockedIssueId: string;
  authz: string;
}): Promise<{ ok: boolean; id?: string }> {
  const metrics = getLinearMetrics();
  metrics.linearSessionOperationsTotal.inc({ operation: "add_relation" });
  try {
    return await withLinearRetry(
      async () => {
        const input = {
          space: params.space,
          action: "add-relation" as const,
          issueId: params.blockingIssueId,
          relatedIssueId: params.blockedIssueId,
          relationType: "blocks" as const,
          authz: params.authz,
        };
        const result = await toolTicket.execute({ input });
        return { ok: result.ok, id: result.id };
      },
      { category: "session", requireStartupBuffer: false }
    );
  } catch (error) {
    logger?.warn?.("linear_add_relation_failed", {
      blockingIssueId: params.blockingIssueId,
      blockedIssueId: params.blockedIssueId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}
