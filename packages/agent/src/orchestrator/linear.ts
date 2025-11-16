// Minimal, dependency-free stubs to avoid cross-package coupling in agent.
// Full Linear integration lives in the API layer and DB repos.

import pRetry, { AbortError } from "p-retry";
import { logger } from "@alfred/metrics";

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
  const stopTimer =
    metrics.linearActivityDurationSeconds.startTimer({ type });
  try {
    const result = await pRetry(
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

        const result = await toolTicket.execute({ input });
        return { ok: result.ok, id: result.id };
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
        onFailedAttempt: (error) => {
          const statusCode = (error as any)?.statusCode;
          if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
            logger?.warn?.("linear_activity_retry", {
              type,
              sessionId: params.sessionId,
              attempt: error.attemptNumber,
              retriesLeft: error.retriesLeft,
            });
            return;
          }
          throw new AbortError(error);
        },
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
    await pRetry(
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
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
        onFailedAttempt: (error) => {
          const statusCode = (error as any)?.statusCode;
          if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
            return;
          }
          throw new AbortError(error);
        },
      }
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
    const result = await pRetry(
      async () => {
        const input = {
          space: params.space,
          action: "set-started" as const,
          issueId: params.issueId,
          authz: params.authz,
        };

        return await toolTicket.execute({ input });
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
        onFailedAttempt: (error) => {
          const statusCode = (error as any)?.statusCode;
          if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
            return;
          }
          throw new AbortError(error);
        },
      }
    );
    const resolved = result as {
      ok: boolean;
      id?: string;
      stateId?: string;
    };
    return { stateId: resolved.stateId ?? "state_unknown" };
  } catch (error) {
    logger?.warn?.("linear_started_failed", {
      issueId: params.issueId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { stateId: "state_stub" };
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
    await pRetry(
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
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
        onFailedAttempt: (error) => {
          const statusCode = (error as any)?.statusCode;
          if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
            return;
          }
          throw new AbortError(error);
        },
      }
    );
  } catch (error) {
    logger?.warn?.("linear_external_url_failed", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function extractIssueIdFromSession(sessionId: string): string | null {
  if (!sessionId || typeof sessionId !== "string") {
    return null;
  }

  const trimmed = sessionId.trim();
  if (trimmed.length === 0 || trimmed.length > 255) {
    return null;
  }

  return trimmed;
}
