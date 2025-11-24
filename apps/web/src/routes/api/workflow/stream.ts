import { createFileRoute } from "@tanstack/react-router";
import type { WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";
import {
  orchestrateWorkflowStream,
  type OrchestratorCallbacks,
} from "@alfred/agent/workflow/orchestrator";
import { workflowInput } from "@alfred/agent/workflow/schema";
import { ensureObligations } from "@alfred/agent/workflow/services";
import { enforceWorkflowPlanPolicy } from "@alfred/api/workflow/access";
import { triggerPreferenceRefresh } from "@alfred/api/preference/refresh";
import { auth } from "@alfred/auth";
import { logger } from "@alfred/logger";

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

function formatEvent(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
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
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let parsedInput: ReturnType<typeof workflowInput.parse>;
  try {
    const body = await request.json();
    const parsed = workflowInput.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "invalid_request", issues: parsed.error.issues }),
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

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "session_required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let obligations: string[] = [];
  try {
    const result = await enforceWorkflowPlanPolicy({
      request,
      session,
      input: parsedInput,
    });
    obligations = result.obligations;
  } catch (error) {
    const status = deriveStatus(error, 403);
    return new Response(JSON.stringify({ error: "access_denied", detail: formatError(error).message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  let cleanup: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
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

      const callbacks: OrchestratorCallbacks = {
        triggerPreferenceRefresh,
        ensureObligations,
        context: { policy: { obligations } },
        emitError: (error) => {
          logger.warn("workflow_sse_emit_error", {
            error: error instanceof Error ? error.message : String(error),
          });
          send(formatEvent("error", formatError(error)));
          cleanup?.();
          close();
        },
        emitNext: (event) => {
          send(formatEvent("workflow-event", event));
        },
        emitComplete: () => {
          send(formatEvent("complete", {}));
          cleanup?.();
          close();
        },
        emitUiMessages: (messages, meta) => {
          const payload: WorkflowSseMeta = { messages, meta };
          send(formatEvent("ui-message", payload));
        },
      };

      const orchestratorSession = { user: { id: session.user.id } };
      orchestrateWorkflowStream(parsedInput, orchestratorSession, callbacks)
        .then((fn) => {
          cleanup = fn;
        })
        .catch((error) => callbacks.emitError(error));

      request.signal.addEventListener("abort", () => {
        cleanup?.();
        close();
      });

      send(encoder.encode(`: workflow-stream\n\n`));
    },
    cancel() {
      cleanup?.();
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
      POST: ({ request }) => handleWorkflowStreamRequest(request),
    },
  },
});
