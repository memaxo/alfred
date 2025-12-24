import type { OrchestratorCallbacks } from "@alfred/agent/workflow/orchestrator";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import {
  sseConnectionRateLimitHitsTotal,
  sseConnectionsCurrent,
  sseFirstChunkLatencySeconds,
} from "@alfred/api/metrics";
import {
  createConnection,
  getConnectionCount,
  removeConnection,
  updateConnectionActivity,
} from "@alfred/api/utils/sse-connections";
import type { Obligation, WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";
import { createFileRoute } from "@tanstack/react-router";

type CreateWorkflowSuspensionFn =
  typeof import("@alfred/api/workflow/suspension").createWorkflowSuspension;

type WorkflowSseMeta = {
  messages: UIMessage[];
  meta: {
    runId: string;
    eventId: string;
    eventType: string;
    originalEvent: WorkflowEvent;
  };
};

const encoder = new TextEncoder();

type WorkflowSuspensionHandle = ReturnType<CreateWorkflowSuspensionFn>;

async function getWorkflowGatekeepers() {
  // Keep the "decide status code" path as light as possible: we must validate,
  // authenticate, and enforce policy before returning an SSE response.
  const schemaPkg = "@alfred/agent/workflow/schema";
  const accessPkg = "@alfred/api/workflow/access";
  const authPkg = "@alfred/auth";

  const [schema, access, authMod] = await Promise.all([
    import(schemaPkg),
    import(accessPkg),
    import(authPkg),
  ]);

  return {
    workflowInput: schema.workflowInput,
    enforceWorkflowPlanPolicy: access.enforceWorkflowPlanPolicy,
    auth: authMod.auth,
  };
}

async function getWorkflowStreamHelpers() {
  // Everything below can be loaded after we've committed to an SSE 200 response.
  const orchestratorPkg = "@alfred/agent/workflow/orchestrator";
  const servicesPkg = "@alfred/agent/workflow/services";
  const preferencePkg = "@alfred/api/preference/refresh";
  const suspensionPkg = "@alfred/api/workflow/suspension";
  const loggerPkg = "@alfred/logger";

  const [orchestrator, services, preference, suspension, loggerMod] =
    await Promise.all([
      import(orchestratorPkg),
      import(servicesPkg),
      import(preferencePkg),
      import(suspensionPkg),
      import(loggerPkg),
    ]);

  return {
    orchestrateWorkflowStream: orchestrator.orchestrateWorkflowStream,
    ensureObligations: services.ensureObligations,
    triggerPreferenceRefresh: preference.triggerPreferenceRefresh,
    createWorkflowSuspension:
      suspension.createWorkflowSuspension as unknown as CreateWorkflowSuspensionFn,
    logger: loggerMod.logger,
  };
}

function formatEvent(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return encoder.encode(payload);
}

function formatError(error: unknown): { message: string } {
  if (error instanceof Error) {
    return { message: error.message };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  return { message: "workflow_stream_error" };
}

function deriveStatus(error: unknown, fallback: number): number {
  if (typeof error === "object" && error !== null) {
    const status = Number((error as Record<string, unknown>).statusCode);
    if (Number.isFinite(status) && status >= 400) {
      return status;
    }
    const code = (error as { code?: string }).code;
    if (code === "TOO_MANY_REQUESTS") {
      return 429;
    }
  }
  return fallback;
}

export async function handleWorkflowStreamRequest(
  request: Request
): Promise<Response> {
  const gate = await getWorkflowGatekeepers();
  const requestStartTime = performance.now();
  let connectionId: string | null = null;
  let firstChunkSent = false;

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let parsedInput: WorkflowInputPayload;
  try {
    const body = await request.json();
    const parsed = gate.workflowInput.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          issues: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    parsedInput = parsed.data;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "invalid_request", detail: String(error) }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const session = await gate.auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "session_required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check connection limits and rate limiting
  const connectionResult = createConnection(session.user.id, "workflow");
  if (!connectionResult.allowed) {
    sseConnectionRateLimitHitsTotal
      .labels("workflow", connectionResult.reason ?? "unknown")
      .inc();
    return new Response(
      JSON.stringify({
        error: "rate_limit_exceeded",
        reason: connectionResult.reason,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    );
  }
  connectionId = connectionResult.connectionId;
  const globalConnectionCount = getConnectionCount();
  sseConnectionsCurrent.labels("workflow").set(globalConnectionCount);

  let obligations: Obligation[] = [];
  try {
    const result = await gate.enforceWorkflowPlanPolicy({
      request,
      session,
      input: parsedInput,
    });
    obligations = result.obligations;
  } catch (error) {
    const status = deriveStatus(error, 403);
    return new Response(
      JSON.stringify({
        error: "access_denied",
        detail: formatError(error).message,
      }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  let cleanup: (() => void) | undefined;
  let suspensionHandle: WorkflowSuspensionHandle | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (bytes: Uint8Array) => {
        if (!closed) {
          controller.enqueue(bytes);
        }
      };
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      const sendWorkflowEvent = (event: WorkflowEvent) => {
        // Track first chunk latency
        if (!firstChunkSent) {
          firstChunkSent = true;
          const firstChunkLatency =
            (performance.now() - requestStartTime) / 1000;
          sseFirstChunkLatencySeconds
            .labels("workflow")
            .observe(firstChunkLatency);
          if (connectionId) {
            updateConnectionActivity(connectionId);
          }
        }
        send(formatEvent("workflow-event", event));
      };

      const orchestratorSession = { user: { id: session.user.id } };

      // Send an immediate workflow event so clients can display "connected" without
      // waiting for orchestrator/tool imports and the first executor emission.
      send(encoder.encode(": workflow-stream\n\n"));
      sendWorkflowEvent({
        type: "notice",
        message: "workflow_stream_ready",
      } as WorkflowEvent);

      const kickoff = async (): Promise<void> => {
        try {
          const h = await getWorkflowStreamHelpers();

          const startWorkflow = async (options?: {
            runId?: string;
            obligations?: Obligation[];
          }) => {
            cleanup?.();
            cleanup = undefined;
            const callbacks: OrchestratorCallbacks = {
              triggerPreferenceRefresh: h.triggerPreferenceRefresh,
              ensureObligations: h.ensureObligations,
              context: {
                policy: {
                  obligations: options?.obligations ?? [],
                },
              },
              emitError: (error) => {
                h.logger.warn("workflow_sse_emit_error", {
                  error: error instanceof Error ? error.message : String(error),
                });
                send(formatEvent("error", formatError(error)));
                if (connectionId) {
                  removeConnection(connectionId);
                  const globalConnectionCount = getConnectionCount();
                  sseConnectionsCurrent
                    .labels("workflow")
                    .set(globalConnectionCount);
                }
                cleanup?.();
                close();
              },
              emitNext: (event) => {
                sendWorkflowEvent(event);
              },
              emitComplete: () => {
                send(formatEvent("complete", {}));
                if (connectionId) {
                  removeConnection(connectionId);
                  const globalConnectionCount = getConnectionCount();
                  sseConnectionsCurrent
                    .labels("workflow")
                    .set(globalConnectionCount);
                }
                cleanup?.();
                close();
              },
              emitUiMessages: (messages, meta) => {
                const payload: WorkflowSseMeta = { messages, meta };
                send(formatEvent("ui-message", payload));
              },
            };

            const payload = options?.runId
              ? { ...parsedInput, runId: options.runId }
              : parsedInput;

            cleanup = await h.orchestrateWorkflowStream(
              payload,
              orchestratorSession,
              callbacks
            );
          };

          suspensionHandle = h.createWorkflowSuspension({
            sessionUserId: session.user.id,
            input: parsedInput,
            transport: "sse",
            auditContext: { auto: parsedInput.auto, mode: parsedInput.mode },
            emitObligation: (payload: {
              runId: string;
              obligations: Obligation[];
              resumeEvents: string[];
            }) => {
              const { runId, obligations, resumeEvents } = payload;
              sendWorkflowEvent({
                type: "obligation",
                runId,
                obligations,
                resumeEvents,
              } as WorkflowEvent);
            },
            policyCheck: async () => {
              const refreshed = await gate.enforceWorkflowPlanPolicy({
                session,
                input: parsedInput,
              });
              return refreshed.obligations;
            },
            startWorkflow: (options: {
              runId: string;
              obligations: Obligation[];
            }) => startWorkflow(options),
            onError: (error: unknown, info: { runId: string }) => {
              const { runId } = info;
              h.logger.error("workflow_resume_failed", {
                runId,
                error: error instanceof Error ? error.message : String(error),
              });
              send(formatEvent("error", formatError(error)));
              cleanup?.();
              close();
            },
            onSuspended: () => {
              h.triggerPreferenceRefresh(session.user.id, {
                reason: "workflow_stream_suspended",
              });
            },
            onResumed: () => {
              h.triggerPreferenceRefresh(session.user.id, {
                reason: "workflow_stream_resumed",
              });
            },
          });

          const suspension = suspensionHandle;
          if (obligations.length > 0) {
            await suspension?.suspend(obligations);
          } else {
            await startWorkflow({ obligations: [] });
          }
        } catch (error) {
          send(formatEvent("error", formatError(error)));
          cleanup?.();
          close();
        }
      };

      void kickoff();

      request.signal.addEventListener("abort", () => {
        if (connectionId) {
          removeConnection(connectionId);
          const globalConnectionCount = getConnectionCount();
          sseConnectionsCurrent.labels("workflow").set(globalConnectionCount);
        }
        cleanup?.();
        void suspensionHandle?.dispose();
        close();
      });
    },
    cancel() {
      closed = true;
      if (connectionId) {
        removeConnection(connectionId);
        const globalConnectionCount = getConnectionCount();
        sseConnectionsCurrent.labels("workflow").set(globalConnectionCount);
      }
      cleanup?.();
      void suspensionHandle?.dispose();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export const Route = createFileRoute("/api/workflow/stream")({
  server: {
    handlers: {
      POST: ({ request }: { request: Request }) =>
        handleWorkflowStreamRequest(request),
    },
  },
});
