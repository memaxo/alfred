/**
 * ALFRED Linear Helper Module
 * Centralized Linear activity emission and session management
 */

import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { linearRepo } from "@alfred/db";
import { LinearClient } from "@linear/sdk";
import { logger } from "@alfred/api/utils/logger";
import {
  linearActivityEmissionsTotal,
  linearActivityDurationSeconds,
  linearSessionOperationsTotal,
} from "@alfred/api/metrics";
import pRetry from "p-retry";

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

/**
 * Call Linear API with retry logic for rate limits and transient errors
 */
async function callLinearWithRetry<T>(
  fn: () => Promise<T>,
  context: { operation: string; sessionId?: string }
): Promise<T> {
  return pRetry(
    async () => {
      try {
        return await fn();
      } catch (error: any) {
        // Retry on rate limit (429) or server errors (5xx)
        if (error?.statusCode === 429 || (error?.statusCode >= 500 && error?.statusCode < 600)) {
          logger.warn("linear_api_rate_limit", {
            operation: context.operation,
            statusCode: error.statusCode,
            sessionId: context.sessionId,
          });
          throw error; // Retry
        }
        throw pRetry.AbortError(error); // Don't retry permanent errors
      }
    },
    {
      retries: 3,
      minTimeout: 1000,
      maxTimeout: 10000,
      factor: 2,
      onFailedAttempt: (error) => {
        logger.warn("linear_api_retry", {
          attempt: error.attemptNumber,
          operation: context.operation,
          error: error.message,
          sessionId: context.sessionId,
        });
      },
    }
  );
}

/**
 * Emit a Linear agent activity (thought, action, response, error)
 * Non-throwing: returns { ok: false } on failure
 */
export async function emitLinearActivity(
  type: LinearActivityType,
  params: LinearActivityParams
): Promise<{ ok: boolean; id?: string }> {
  const stopTimer = linearActivityDurationSeconds.startTimer({ type });
  try {
    await requireToolScopesAndPolicy(params.authz, ["linear.write"], {
      action: `linear.activity.${type}`,
      resource: { kind: "linear", id: params.space },
    });

    const installation = await linearRepo.getLinearByWorkspace(params.space);
    if (!installation) {
      logger.warn("linear_installation_missing", { space: params.space });
      linearActivityEmissionsTotal.inc({ type, status: "error" });
      return { ok: false };
    }

    const client = new LinearClient({ accessToken: installation.token });

    const content: Record<string, unknown> = { type };
    if (params.title) content.title = params.title;
    if (params.body) content.body = params.body;
    if (params.parameter) content.parameter = params.parameter;
    if (params.result) content.result = params.result;

    const payload = {
      agentSessionId: params.sessionId,
      content,
      ephemeral: params.ephemeral,
    };

    const response = await callLinearWithRetry(
      async () => {
        return await client.createAgentActivity(payload as any);
      },
      { operation: `activity.${type}`, sessionId: params.sessionId }
    );

    const activity = await response.agentActivity;

    if (!(response.success && activity?.id)) {
      logger.warn("linear_activity_failed", {
        type,
        sessionId: params.sessionId,
        success: response.success,
      });
      linearActivityEmissionsTotal.inc({ type, status: "error" });
      return { ok: false };
    }

    linearActivityEmissionsTotal.inc({ type, status: "ok" });
    return { ok: true, id: activity.id };
  } catch (error) {
    logger.warn("linear_activity_emission_error", {
      type,
      sessionId: params.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    linearActivityEmissionsTotal.inc({ type, status: "error" });
    return { ok: false };
  } finally {
    stopTimer();
  }
}

/**
 * Set Linear issue delegate (assignee)
 * Non-throwing: logs errors but doesn't throw
 */
export async function setLinearDelegate(
  params: LinearSessionParams
): Promise<void> {
  try {
    await requireToolScopesAndPolicy(params.authz, ["linear.write"], {
      action: "linear.set-delegate",
      resource: { kind: "linear", id: params.space },
    });

    const installation = await linearRepo.getLinearByWorkspace(params.space);
    if (!installation) {
      logger.warn("linear_installation_missing", { space: params.space });
      linearSessionOperationsTotal.inc({ operation: "delegate", status: "error" });
      return;
    }

    const client = new LinearClient({ accessToken: installation.token });
    const delegate = params.delegateId ?? installation.appUser;

    const response = await callLinearWithRetry(
      async () => {
        return await client.updateIssue(params.issueId, {
          assigneeId: delegate,
        });
      },
      { operation: "set-delegate", sessionId: params.issueId }
    );

    if (!response.success) {
      logger.warn("linear_delegate_failed", {
        issueId: params.issueId,
        delegate,
      });
      linearSessionOperationsTotal.inc({ operation: "delegate", status: "error" });
    } else {
      linearSessionOperationsTotal.inc({ operation: "delegate", status: "ok" });
    }
  } catch (error) {
    logger.warn("linear_delegate_error", {
      issueId: params.issueId,
      error: error instanceof Error ? error.message : String(error),
    });
    linearSessionOperationsTotal.inc({ operation: "delegate", status: "error" });
  }
}

/**
 * Set Linear issue state to "started" (or first "progress" state)
 * Throws on failure (used during workflow initialization)
 */
export async function setLinearStarted(
  params: LinearSessionParams
): Promise<{ stateId: string }> {
  await requireToolScopesAndPolicy(params.authz, ["linear.write"], {
    action: "linear.set-started",
    resource: { kind: "linear", id: params.space },
  });

  const installation = await linearRepo.getLinearByWorkspace(params.space);
  if (!installation) {
    linearSessionOperationsTotal.inc({ operation: "started", status: "error" });
    throw new Error("linear_installation_missing");
  }

  const client = new LinearClient({ accessToken: installation.token });
  const issue = await client.issue(params.issueId);
  if (!issue) {
    linearSessionOperationsTotal.inc({ operation: "started", status: "error" });
    throw new Error("linear_issue_not_found");
  }

  const team = await issue.team;
  if (!team) {
    linearSessionOperationsTotal.inc({ operation: "started", status: "error" });
    throw new Error("linear_team_not_found");
  }

  const statesConnection = await team.states();
  const states = statesConnection.nodes ?? [];

  const targetState =
    states.find((state) => state.type === "started") ??
    states.find((state) =>
      state.name.toLowerCase().includes("progress")
    ) ??
    null;

  if (!targetState) {
    linearSessionOperationsTotal.inc({ operation: "started", status: "error" });
    throw new Error("linear_started_state_missing");
  }

  const response = await callLinearWithRetry(
    async () => {
      return await client.updateIssue(params.issueId, {
        stateId: targetState.id,
      });
    },
    { operation: "set-started", sessionId: params.issueId }
  );

  if (!response.success) {
    linearSessionOperationsTotal.inc({ operation: "started", status: "error" });
    throw new Error("linear_state_update_failed");
  }

  linearSessionOperationsTotal.inc({ operation: "started", status: "ok" });
  return { stateId: targetState.id };
}

/**
 * Set Linear agent session external URL
 * Non-throwing: logs errors but doesn't throw
 */
export async function setLinearSessionExternalUrl(
  sessionId: string,
  space: string,
  authz: string,
  url: string
): Promise<void> {
  try {
    await requireToolScopesAndPolicy(authz, ["linear.write"], {
      action: "linear.session.external-url",
      resource: { kind: "linear", id: space },
    });

    const installation = await linearRepo.getLinearByWorkspace(space);
    if (!installation) {
      logger.warn("linear_installation_missing", { space });
      return;
    }

    const client = new LinearClient({ accessToken: installation.token });

    const response = await callLinearWithRetry(
      async () => {
        return await client.agentSessionUpdateExternalUrl(sessionId, {
          externalLink: url,
        });
      },
      { operation: "session.external-url", sessionId }
    );

    if (!response.success) {
      logger.warn("linear_session_external_url_failed", {
        sessionId,
        url,
      });
    }
  } catch (error) {
    logger.warn("linear_session_external_url_error", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Extract Linear issue ID from agent session ID.
 * Linear agent session IDs are typically the issue ID itself.
 * Returns null if extraction fails.
 */
export function extractIssueIdFromSession(
  sessionId: string
): string | null {
  // Linear session IDs are typically the issue ID
  // Validate format if needed (e.g., UUID format)
  if (sessionId && sessionId.length > 0) {
    return sessionId;
  }
  return null;
}

