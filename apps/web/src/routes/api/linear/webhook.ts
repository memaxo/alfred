import crypto from "node:crypto";
import { appRouter } from "@alfred/api";
import { webhookErrorsTotal, webhookEventsTotal } from "@alfred/api/metrics";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { createFileRoute } from "@tanstack/react-router";

const MAX_AGE_SECONDS = 5 * 60; // tolerate up to 5 minutes of clock drift

function getWebhookSecret(): string {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("linear_webhook_secret_missing");
  }
  return secret;
}

interface ParsedSignatureHeader {
  timestamp: number;
  signature: string;
}

function parseSignatureHeader(
  raw: string | null
): ParsedSignatureHeader | null {
  if (!raw) return null;
  const parts = raw.split(",");
  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!(key && value)) continue;
    const trimmedKey = key.trim().toLowerCase();
    const trimmedValue = value.trim();
    if (trimmedKey === "t") {
      const parsed = Number.parseInt(trimmedValue, 10);
      if (Number.isFinite(parsed)) {
        timestamp = parsed;
      }
    } else if (trimmedKey === "v1") {
      signature = trimmedValue;
    }
  }

  if (!(timestamp && signature)) {
    return null;
  }

  return { timestamp, signature };
}

function verifySignature(
  secret: string,
  timestamp: number,
  payload: string,
  expected: string
): boolean {
  const body = `${timestamp}:${payload}`;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const providedBuffer = Buffer.from(expected, "hex");
  const computedBuffer = Buffer.from(computed, "hex");

  if (providedBuffer.length !== computedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, computedBuffer);
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

const AUTHZ_PATHS: Array<string[]> = [
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
        } catch (error) {
          webhookErrorsTotal.labels("secret").inc();
          return new Response("missing_secret", { status: 500 });
        }

        const rawBody = await request.text();
        const header = parseSignatureHeader(
          request.headers.get("linear-signature")
        );
        if (!header) {
          webhookErrorsTotal.labels("signature").inc();
          return new Response("invalid_signature", { status: 401 });
        }

        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - header.timestamp) > MAX_AGE_SECONDS) {
          webhookErrorsTotal.labels("timestamp").inc();
          return new Response("stale_signature", { status: 401 });
        }

        const validSignature = verifySignature(
          secret,
          header.timestamp,
          rawBody,
          header.signature
        );
        if (!validSignature) {
          webhookErrorsTotal.labels("signature").inc();
          return new Response("invalid_signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
        } catch {
          webhookErrorsTotal.labels("payload").inc();
          return new Response("invalid_payload", { status: 400 });
        }

        const eventType = extractEventType(payload);
        webhookEventsTotal.labels(eventType).inc();

        const runIdCandidate = (
          payload as { data?: { agentSessionId?: unknown } }
        )?.data?.agentSessionId;
        const runId =
          typeof runIdCandidate === "string" && runIdCandidate.length > 0
            ? runIdCandidate
            : crypto.randomUUID();

        const authz = extractAuthz(payload);

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
            console.error("[linear-webhook] Failed to resume workflow:", error);
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
