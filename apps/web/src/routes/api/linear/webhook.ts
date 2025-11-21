import crypto from "node:crypto";
import { appRouter } from "@alfred/api";
import {
  linearWebhookEventsTotal,
  linearWebhookWorkflowCancelsTotal,
  linearWebhookWorkflowStartsTotal,
  webhookErrorsTotal,
  webhookEventsTotal,
} from "@alfred/api/metrics";
import { runRegistry } from "@alfred/api/run-registry";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { linearRepo } from "@alfred/db";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { RuntimeContext } from "@alfred/type/runtime-context";
import {
  LINEAR_WEBHOOK_SIGNATURE_HEADER,
  LINEAR_WEBHOOK_TS_FIELD,
  LinearWebhooks,
} from "@linear/sdk/webhooks";
import { createFileRoute } from "@tanstack/react-router";

const MAX_AGE_SECONDS = 5 * 60; // tolerate up to 5 minutes of clock drift

function getWebhookSecret(): string {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("linear_webhook_secret_missing");
  }
  return secret;
}

function extractIssueId(payload: unknown): string | null {
  const data = (payload as { data?: { id?: string } })?.data;
  return data?.id ?? null;
}

function extractWorkspace(payload: unknown): string | null {
  const data = (payload as { data?: { workspace?: { id?: string } } })?.data;
  return data?.workspace?.id ?? null;
}

function isAssignedToAlfred(payload: unknown, appUserId: string): boolean {
  const issue = (payload as { data?: { assignee?: { id?: string } } })?.data;
  return issue?.assignee?.id === appUserId;
}

function extractIssueIdFromComment(payload: unknown): string | null {
  const comment = (payload as { data?: { issue?: { id?: string } } })?.data;
  return comment?.issue?.id ?? null;
}

function isIssueStateCompletedOrCanceled(payload: unknown): boolean {
  const issue = (payload as { data?: { state?: { type?: string } } })?.data;
  const stateType = issue?.state?.type;
  return stateType === "completed" || stateType === "canceled";
}

function extractEventType(body: unknown): string {
  if (body && typeof body === "object") {
    const candidate = (body as { type?: unknown }).type;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }

    const action = (body as { action?: unknown }).action;
    if (typeof action === "string" && action.length > 0) {
      return action;
    }
  }
  return "unknown";
}

const AUTHZ_PATHS: string[][] = [
  ["data", "authorization"],
  ["data", "authz"],
  ["data", "agentSession", "authorization"],
  ["data", "agentSession", "authorization", "token"],
  ["data", "agentSession", "authz"],
  ["data", "authorization", "value"],
  ["data", "authorization", "token"],
  ["data", "metadata", "authz"],
];

function extractAuthz(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  for (const path of AUTHZ_PATHS) {
    let current: unknown = payload;
    for (const segment of path) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (typeof current === "string" && current.trim().length > 0) {
      return current.trim();
    }
    if (current && typeof current === "object") {
      const token = (current as { token?: unknown }).token;
      if (typeof token === "string" && token.trim().length > 0) {
        return token.trim();
      }
      const value = (current as { value?: unknown }).value;
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return null;
}

async function handleLinearWebhookEvent(args: {
  payload: unknown;
  eventType: string;
  action: string;
  authz: string | null;
}): Promise<void> {
  const { payload, eventType, action, authz } = args;

  if (eventType === "Issue" && (action === "create" || action === "update")) {
    const workspace = extractWorkspace(payload);
    if (workspace) {
      const installation = await linearRepo.getLinearByWorkspace(workspace);
      if (installation && isAssignedToAlfred(payload, installation.appUser)) {
        const issueId = extractIssueId(payload);
        if (issueId) {
          const existingRun =
            await workflowRepo.findRunByLinearSession(issueId);
          if (!existingRun || existingRun.status !== "running") {
            const issue = (
              payload as {
                data?: { title?: string; description?: string };
              }
            )?.data;
            const requirement =
              issue?.description ?? issue?.title ?? "Work on Linear issue";

            const caller = createWorkflowCaller(`linear-webhook-${issueId}`);
            try {
              await caller.workflow.start({
                requirement,
                auto: "low",
                linear: {
                  space: workspace,
                  sessionId: issueId,
                },
                authzLinear: authz ?? undefined,
              });
              linearWebhookWorkflowStartsTotal.inc();
              logger.info("linear_webhook_workflow_started", {
                issueId,
                workspace,
              });
            } catch (error) {
              logger.warn("linear_webhook_workflow_start_failed", {
                issueId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
      }
    }
  }

  if (eventType === "Comment" && action === "create") {
    const issueId = extractIssueIdFromComment(payload);
    if (issueId) {
      const workflow = await workflowRepo.findRunByLinearSession(issueId);
      if (workflow && workflow.status === "running") {
        logger.info("linear_comment_received", {
          runId: workflow.id,
          issueId,
        });
        // TODO: Persist comment for contextual enrichment in future iterations
      }
    }
  }

  if (
    eventType === "Issue" &&
    action === "update" &&
    isIssueStateCompletedOrCanceled(payload)
  ) {
    const issueId = extractIssueId(payload);
    if (issueId) {
      const workflow = await workflowRepo.findRunByLinearSession(issueId);
      if (workflow && workflow.status === "running") {
        try {
          await runRegistry.dispatchCancel(workflow.id);
          await workflowRepo.updateRun(workflow.id, {
            status: "cancelled",
          });
          linearWebhookWorkflowCancelsTotal.inc();
          logger.info("linear_webhook_workflow_cancelled", {
            runId: workflow.id,
            issueId,
          });
        } catch (error) {
          logger.warn("linear_webhook_workflow_cancel_failed", {
            runId: workflow.id,
            issueId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }
}

function createWorkflowCaller(requestId: string) {
  return appRouter.createCaller({
    session: {
      user: {
        id: "system",
        roles: ["system"],
        scopes: ["workflow.plan", "linear.write"],
        email: "system@alfred.local",
        name: "Linear Webhook",
      },
    } as any,
    runtime: {
      requestId,
      receivedAt: new Date(),
      method: "POST",
      url: "linear:webhook",
      ip: null,
      forwardedFor: [],
      userAgent: "linear-webhook",
      referer: null,
    },
    runtimeContext: new RuntimeContext([["requestId", requestId]]),
    policy: {
      obligations: [],
    },
  });
}

export const Route = createFileRoute("/api/linear/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let secret: string;
        try {
          secret = getWebhookSecret();
        } catch (_error) {
          webhookErrorsTotal.labels("secret").inc();
          return new Response("missing_secret", { status: 500 });
        }

        const webhookVerifier = new LinearWebhooks(secret);
        const rawBody = await request.text();
        const signature = request.headers.get(LINEAR_WEBHOOK_SIGNATURE_HEADER);
        if (!signature) {
          webhookErrorsTotal.labels("signature").inc();
          return new Response("missing_signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
        } catch {
          webhookErrorsTotal.labels("payload").inc();
          return new Response("invalid_payload", { status: 400 });
        }

        const timestampValue = (payload as Record<string, unknown> | null)?.[
          LINEAR_WEBHOOK_TS_FIELD
        ];
        let timestamp: number | undefined;
        if (typeof timestampValue === "number") {
          timestamp = timestampValue;
        } else if (typeof timestampValue === "string") {
          const parsed = Number.parseInt(timestampValue, 10);
          if (Number.isFinite(parsed)) {
            timestamp = parsed;
          }
        }
        if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
          webhookErrorsTotal.labels("timestamp").inc();
          return new Response("invalid_timestamp", { status: 400 });
        }

        const timestampSeconds =
          timestamp > 1_000_000_000_000
            ? Math.floor(timestamp / 1000)
            : Math.floor(timestamp);
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSeconds - timestampSeconds) > MAX_AGE_SECONDS) {
          webhookErrorsTotal.labels("timestamp").inc();
          return new Response("stale_signature", { status: 401 });
        }

        const verified = webhookVerifier.verify(
          Buffer.from(rawBody),
          signature,
          timestamp
        );
        if (!verified) {
          webhookErrorsTotal.labels("signature").inc();
          return new Response("invalid_signature", { status: 401 });
        }

        const eventType = extractEventType(payload);
        const action = (payload as { action?: string })?.action ?? "unknown";
        webhookEventsTotal.labels(eventType).inc();
        linearWebhookEventsTotal.inc({ event_type: eventType, action });

        const authz = extractAuthz(payload);

        handleLinearWebhookEvent({ payload, eventType, action, authz }).catch(
          (error) => {
            webhookErrorsTotal.labels("processing").inc();
            logger.error("linear_webhook_processing_failed", {
              eventType,
              action,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        );

        const runIdCandidate = (
          payload as { data?: { agentSessionId?: unknown } }
        )?.data?.agentSessionId;
        const runId =
          typeof runIdCandidate === "string" && runIdCandidate.length > 0
            ? runIdCandidate
            : crypto.randomUUID();

        // Handle resume for linear-authz events (existing functionality)
        if (authz && authz.length > 0) {
          try {
            await requireToolScopesAndPolicy(
              authz.startsWith("Bearer ") ? authz : `Bearer ${authz}`,
              ["linear.write"],
              {
                action: "workflow.resume",
                resource: {
                  kind: "workflow",
                  id: runId,
                },
                context: {
                  event: "linear-authz",
                },
              }
            );
          } catch {
            webhookErrorsTotal.labels("authz").inc();
            return new Response("invalid_authz", { status: 401 });
          }

          const caller = createWorkflowCaller(`linear-webhook-${runId}`);
          try {
            await caller.workflow.resume({
              runId,
              event: "linear-authz",
              authz,
            });
          } catch (error) {
            logger.error("linear_webhook_resume_failed", {
              runId,
              error: error instanceof Error ? error.message : String(error),
            });
            webhookErrorsTotal.labels("resume").inc();
            return new Response("resume_failed", { status: 500 });
          }
        }

        return new Response(
          JSON.stringify({ ok: true, runId, resumed: Boolean(authz) }),
          {
            status: 202,
            headers: {
              "content-type": "application/json",
            },
          }
        );
      },
    },
  },
});
