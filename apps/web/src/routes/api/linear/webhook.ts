import { mastra } from "@alfred/agent";
import { webhookEventsTotal, webhookErrorsTotal } from "@alfred/api/metrics";
import crypto from "node:crypto";
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

function parseSignatureHeader(raw: string | null): ParsedSignatureHeader | null {
  if (!raw) return null;
  const parts = raw.split(",");
  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!key || !value) continue;
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

  if (!timestamp || !signature) {
    return null;
  }

  return { timestamp, signature };
}

function verifySignature(secret: string, timestamp: number, payload: string, expected: string): boolean {
  const body = `${timestamp}:${payload}`;
  const computed = crypto.createHmac("sha256", secret).update(body).digest("hex");

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
        const header = parseSignatureHeader(request.headers.get("linear-signature"));
        if (!header) {
          webhookErrorsTotal.labels("signature").inc();
          return new Response("invalid_signature", { status: 401 });
        }

        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - header.timestamp) > MAX_AGE_SECONDS) {
          webhookErrorsTotal.labels("timestamp").inc();
          return new Response("stale_signature", { status: 401 });
        }

        const validSignature = verifySignature(secret, header.timestamp, rawBody, header.signature);
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

        const runIdCandidate =
          (payload as { data?: { agentSessionId?: unknown } })?.data?.agentSessionId;
        const runId = typeof runIdCandidate === "string" && runIdCandidate.length > 0 ? runIdCandidate : mastra.generateId();

        try {
          await mastra.pubsub.publish("linear.agent_activity", {
            type: eventType,
            data: payload,
            runId,
          });
        } catch {
          webhookErrorsTotal.labels("publish").inc();
          return new Response("publish_failed", { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 202,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    },
  },
});
