import type { Context } from "./context";

type AuthSession = NonNullable<Context["session"]>;

const MAX_AGE_SECONDS = 5 * 60; // tolerate up to 5 minutes of clock drift

// Lazy-loaded helpers wrapper
async function getHelpers() {
  const [router, metrics, token, db, workflowRepo, log, runtimeContext] =
    await Promise.all([
      import("./router"),
      import("./metrics"),
      import("@alfred/auth/token"),
      import("@alfred/db"),
      import("@alfred/db/repo/workflow"),
      import("@alfred/logger"),
      import("@alfred/type/runtime-context"),
    ]);

  const linearWebhooksPkgName = "@linear/sdk/webhooks";
  const linearIntegrationPkg = "@alfred/agent/orchestrator/linear";

  const [linearWebhooks, linearIntegration] = await Promise.all([
    import(linearWebhooksPkgName),
    import(linearIntegrationPkg),
  ]);

  return {
    appRouter: router.appRouter,
    metrics,
    requireToolScopesAndPolicy: token.requireToolScopesAndPolicy,
    linearRepo: db.linearRepo,
    workflowRepo,
    logger: log.logger,
    RuntimeContext: runtimeContext.RuntimeContext,
    linearWebhooksPkg: (linearWebhooks as { default: unknown }).default,
    commentOnLinearIssue: linearIntegration.commentOnLinearIssue,
  };
}

function workflowUrlFor(runId: string | null): string | null {
  const base =
    process.env.PUBLIC_URL ??
    process.env.VITE_APP_URL ??
    process.env.APP_URL ??
    null;
  if (!(runId && base)) {
    return null;
  }
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/workflow/${runId}`;
}

async function postLinearComment(args: {
  commentOnLinearIssue: (input: {
    space: string;
    issueId: string;
    authz: string;
    body: string;
  }) => Promise<void>;
  space: string;
  issueId: string;
  authz: string;
  body: string;
  logger: { warn: (msg: string, meta?: Record<string, unknown>) => void };
}): Promise<void> {
  try {
    await args.commentOnLinearIssue({
      space: args.space,
      issueId: args.issueId,
      authz: args.authz,
      body: args.body,
    });
  } catch (error) {
    args.logger?.warn?.("linear_webhook_comment_failed", {
      issueId: args.issueId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildWebhookStartComment(
  runId: string | null,
  workflowUrl: string | null
) {
  const lines = [
    "Alfred accepted this issue and started an automated workflow.",
  ];
  if (workflowUrl) {
    lines.push(`Track progress: ${workflowUrl}`);
  } else if (runId) {
    lines.push(`Run id: ${runId}`);
  }
  return lines.join("\n");
}

function buildWebhookCancelComment(
  runId: string | null,
  workflowUrl: string | null,
  reason: string
) {
  const lines = [
    `Workflow run ${runId ?? "unknown"} was cancelled because Linear moved this issue to ${reason}.`,
  ];
  if (workflowUrl) {
    lines.push(`Historical log: ${workflowUrl}`);
  }
  return lines.join("\n");
}

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

function extractCommentContext(payload: unknown): {
  id: string | null;
  body: string | null;
  createdAt: string | null;
  userId: string | null;
  userName: string | null;
} {
  const data = (payload as { data?: Record<string, unknown> })?.data ?? null;
  if (!data) {
    return {
      id: null,
      body: null,
      createdAt: null,
      userId: null,
      userName: null,
    };
  }

  const id = typeof data.id === "string" ? data.id : null;
  const body = typeof data.body === "string" ? data.body : null;
  const createdAt = typeof data.createdAt === "string" ? data.createdAt : null;
  const user = (data.user as Record<string, unknown> | undefined) ?? undefined;
  const userId = typeof user?.id === "string" ? user.id : null;
  const userName = typeof user?.name === "string" ? user.name : null;

  return { id, body, createdAt, userId, userName };
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

    const { action } = body as { action?: unknown };
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
      const { token } = current as { token?: unknown };
      if (typeof token === "string" && token.trim().length > 0) {
        return token.trim();
      }
      const { value } = current as { value?: unknown };
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
  const h = await getHelpers();

  if (eventType === "Issue" && (action === "create" || action === "update")) {
    const workspace = extractWorkspace(payload);
    if (workspace) {
      const installation = await h.linearRepo.getLinearByWorkspace(workspace);
      if (installation && isAssignedToAlfred(payload, installation.appUser)) {
        const issueId = extractIssueId(payload);
        if (issueId) {
          const existingRun =
            await h.workflowRepo.findRunByLinearSession(issueId);
          if (!existingRun || existingRun.status !== "running") {
            const issue = (
              payload as {
                data?: { title?: string; description?: string };
              }
            )?.data;
            const requirement =
              issue?.description ?? issue?.title ?? "Work on Linear issue";

            const caller = await createWorkflowCaller(
              `linear-webhook-${issueId}`,
              h
            );
            try {
              const startResult = await caller.workflow.start({
                requirement,
                auto: "low",
                linear: {
                  space: workspace,
                  sessionId: issueId,
                },
                authzLinear: authz ?? undefined,
              });
              const runId =
                startResult && typeof startResult.runId === "string"
                  ? startResult.runId
                  : issueId;

              // Start execution via the pipeline stream (fire-and-forget).
              void (async () => {
                try {
                  const stream = await caller.workflow.streamPipeline({
                    requirement,
                    auto: "low",
                    linear: {
                      space: workspace,
                      sessionId: issueId,
                    },
                    authzLinear: authz ?? undefined,
                    runId,
                  });

                  const sub = (
                    stream as unknown as {
                      subscribe: (handlers: {
                        next: (event: unknown) => void;
                        error: (err: unknown) => void;
                        complete: () => void;
                      }) => { unsubscribe: () => void } | (() => void);
                    }
                  ).subscribe({
                    next: () => {},
                    error: (err) => {
                      h.logger.warn("linear_webhook_workflow_stream_error", {
                        error: err instanceof Error ? err.message : String(err),
                        issueId,
                        runId,
                        workspace,
                      });
                    },
                    complete: () => {},
                  });

                  const unsubscribe =
                    typeof sub === "function" ? sub : sub.unsubscribe;

                  const timer = setTimeout(
                    () => {
                      unsubscribe();
                    },
                    30 * 60 * 1000
                  );
                  timer.unref?.();
                } catch (error) {
                  h.logger.warn("linear_webhook_workflow_stream_start_failed", {
                    error:
                      error instanceof Error ? error.message : String(error),
                    issueId,
                    runId,
                    workspace,
                  });
                }
              })();

              h.metrics.linearWebhookWorkflowStartsTotal.inc();
              h.logger.info("linear_webhook_workflow_started", {
                issueId,
                workspace,
              });
              if (authz) {
                await postLinearComment({
                  commentOnLinearIssue: h.commentOnLinearIssue,
                  space: workspace,
                  issueId,
                  authz,
                  body: buildWebhookStartComment(runId, workflowUrlFor(runId)),
                  logger: h.logger,
                });
              }
            } catch (error) {
              h.logger.warn("linear_webhook_workflow_start_failed", {
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
      const workflow = await h.workflowRepo.findRunByLinearSession(issueId);
      if (workflow && workflow.status === "running") {
        h.logger.info("linear_comment_received", {
          runId: workflow.id,
          issueId,
        });
        const ctx = extractCommentContext(payload);
        const createdAt =
          ctx.createdAt && Number.isFinite(Date.parse(ctx.createdAt))
            ? new Date(ctx.createdAt)
            : new Date();
        await h.workflowRepo.appendEvent({
          runId: workflow.id,
          eventType: "context",
          timestamp: createdAt,
          eventData: {
            kind: "linear.comment",
            issueId,
            commentId: ctx.id,
            body: ctx.body,
            userId: ctx.userId,
            userName: ctx.userName,
            createdAt: ctx.createdAt,
          },
        });
      }
    }
  }

  if (
    eventType === "Issue" &&
    action === "update" &&
    isIssueStateCompletedOrCanceled(payload)
  ) {
    const issueId = extractIssueId(payload);
    const cancelWorkspace = extractWorkspace(payload);
    if (issueId) {
      const workflow = await h.workflowRepo.findRunByLinearSession(issueId);
      if (workflow && workflow.status === "running") {
        try {
          // Cancel the workflow by updating its status
          // Note: dispatchCancel is not available on RunRegistry, we just update the DB
          await h.workflowRepo.updateRun(workflow.id, {
            status: "cancelled",
          });
          h.metrics.linearWebhookWorkflowCancelsTotal.inc();
          h.logger.info("linear_webhook_workflow_cancelled", {
            runId: workflow.id,
            issueId,
          });
          if (authz) {
            await postLinearComment({
              commentOnLinearIssue: h.commentOnLinearIssue,
              space: workflow.linearSpace ?? cancelWorkspace ?? "",
              issueId,
              authz,
              body: buildWebhookCancelComment(
                workflow.id,
                workflowUrlFor(workflow.id),
                "a user action in Linear"
              ),
              logger: h.logger,
            });
          }
        } catch (error) {
          h.logger.warn("linear_webhook_workflow_cancel_failed", {
            runId: workflow.id,
            issueId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }
}

function createWorkflowCaller(
  requestId: string,
  h: Awaited<ReturnType<typeof getHelpers>>
) {
  const now = new Date();
  const session: AuthSession = {
    user: {
      id: "system",
      createdAt: now,
      updatedAt: now,
      email: "system@alfred.local",
      emailVerified: true,
      name: "Linear Webhook",
      image: null,
    },
    session: {
      id: `system-${requestId}`,
      createdAt: now,
      updatedAt: now,
      userId: "system",
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      token: `system-${requestId}`,
      ipAddress: null,
      userAgent: "linear-webhook",
    },
  };

  const sessionUser = session.user as unknown as {
    roles?: string[];
    scopes?: string[];
  };
  sessionUser.roles = ["system"];
  sessionUser.scopes = ["workflow.plan", "linear.write"];

  return h.appRouter.createCaller({
    session,
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
    runtimeContext: new h.RuntimeContext([
      ["requestId", requestId],
      ["scanContext", null],
    ]),
    policy: {
      obligations: [],
    },
  });
}

export async function handleLinearWebhook(request: Request): Promise<Response> {
  const h = await getHelpers();
  const { randomUUID } = await import("node:crypto");

  let secret: string;
  try {
    secret = getWebhookSecret();
  } catch {
    h.metrics.webhookErrorsTotal.labels("secret").inc();
    return new Response("missing_secret", { status: 500 });
  }

  const {
    LinearWebhookClient,
    LINEAR_WEBHOOK_SIGNATURE_HEADER,
    LINEAR_WEBHOOK_TS_FIELD,
  } = h.linearWebhooksPkg as unknown as {
    LinearWebhookClient: new (secret: string) => {
      verify: (
        body: Buffer,
        signature: string,
        ts: number
      ) => Record<string, unknown>;
    };
    LINEAR_WEBHOOK_SIGNATURE_HEADER: string;
    LINEAR_WEBHOOK_TS_FIELD: string;
  };
  const webhookVerifier = new LinearWebhookClient(secret);
  const rawBody = await request.text();
  const signature = request.headers.get(LINEAR_WEBHOOK_SIGNATURE_HEADER);
  if (!signature) {
    h.metrics.webhookErrorsTotal.labels("signature").inc();
    return new Response("missing_signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    h.metrics.webhookErrorsTotal.labels("payload").inc();
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
    h.metrics.webhookErrorsTotal.labels("timestamp").inc();
    return new Response("invalid_timestamp", { status: 400 });
  }

  const timestampSeconds =
    timestamp > 1_000_000_000_000
      ? Math.floor(timestamp / 1000)
      : Math.floor(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_AGE_SECONDS) {
    h.metrics.webhookErrorsTotal.labels("timestamp").inc();
    return new Response("stale_signature", { status: 401 });
  }

  const verified = webhookVerifier.verify(
    Buffer.from(rawBody),
    signature,
    timestamp
  );
  if (!verified) {
    h.metrics.webhookErrorsTotal.labels("signature").inc();
    return new Response("invalid_signature", { status: 401 });
  }

  const eventType = extractEventType(payload);
  const action = (payload as { action?: string })?.action ?? "unknown";
  h.metrics.webhookEventsTotal.labels(eventType).inc();
  h.metrics.linearWebhookEventsTotal.inc({
    event_type: eventType,
    action,
  });

  const authz = extractAuthz(payload);

  handleLinearWebhookEvent({ payload, eventType, action, authz }).catch(
    (error) => {
      h.metrics.webhookErrorsTotal.labels("processing").inc();
      h.logger.error("linear_webhook_processing_failed", {
        eventType,
        action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  );

  const runIdCandidate = (payload as { data?: { agentSessionId?: unknown } })
    ?.data?.agentSessionId;
  const runId =
    typeof runIdCandidate === "string" && runIdCandidate.length > 0
      ? runIdCandidate
      : randomUUID();

  // Handle resume for linear-authz events (existing functionality)
  if (authz && authz.length > 0) {
    try {
      await h.requireToolScopesAndPolicy(
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
      h.metrics.webhookErrorsTotal.labels("authz").inc();
      return new Response("invalid_authz", { status: 401 });
    }

    const caller = await createWorkflowCaller(`linear-webhook-${runId}`, h);
    try {
      await caller.workflow.resume({
        runId,
        event: "linear-authz",
        authz,
      });
    } catch (error) {
      h.logger.error("linear_webhook_resume_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
      h.metrics.webhookErrorsTotal.labels("resume").inc();
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
}
