import type { AppRouter } from "@alfred/api/routers";
import type { Obligation, ObligationResumeEvent } from "@alfred/type";
import type { createTRPCProxyClient } from "@trpc/client";

import { toast } from "sonner";

import { formatCodexErrorMessage } from "@/lib/codex-errors";

export type DroidStreamEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "exit"; code: number }
  | { type: "notice"; message: string }
  | {
      type: "obligation";
      runId: string;
      obligations: Obligation[];
      resumeEvents?: ObligationResumeEvent[];
    }
  | { type: "resume"; runId: string };

type RawDroidStreamEvent =
  | { type: "stdout"; data?: string }
  | { type: "stderr"; data?: string }
  | { type: "exit"; code?: number }
  | { type: "notice"; data?: string }
  | { type: "obligation"; data?: string }
  | { type: "resume"; data?: string };

export type DroidStreamOptions = {
  input: {
    prompt: string;
    auto: "read" | "low" | "medium" | "high";
    authz: string;
    out?: "text" | "json" | "debug";
    timeoutSec?: number;
  };
  client: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
  onObligation?: (payload: {
    runId: string;
    obligations: Obligation[];
    resumeEvents?: ObligationResumeEvent[];
  }) => void;
  onResume?: (payload: { runId: string }) => void;
  onEvent?: (event: DroidStreamEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
};

type DroidStreamTestHarness = {
  subscribe: (options: DroidStreamOptions) => { unsubscribe: () => void };
};

function getTestHarness(): DroidStreamTestHarness | null {
  if (typeof globalThis === "undefined") {
    return null;
  }
  const scope = globalThis as {
    __droidStreamTestHarness__?: DroidStreamTestHarness;
  };
  return scope.__droidStreamTestHarness__ ?? null;
}

function normalizeObligations(value: unknown): Obligation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: Obligation[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as { type?: unknown }).type === "string" &&
      typeof (entry as { reason?: unknown }).reason === "string"
    ) {
      const metadata = (entry as { metadata?: unknown }).metadata;
      result.push({
        type: (entry as { type: string }).type,
        reason: (entry as { reason: string }).reason,
        metadata:
          metadata && typeof metadata === "object"
            ? (metadata as Record<string, unknown>)
            : undefined,
      });
      continue;
    }
    if (typeof entry === "string") {
      result.push({ type: entry, reason: entry, metadata: { code: entry } });
    }
  }
  return result;
}

function normalizeResumeEvents(value: unknown): ObligationResumeEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowed: ObligationResumeEvent[] = [
    "bio-authz",
    "mfa-authz",
    "human-authz",
  ];
  const result: ObligationResumeEvent[] = [];
  for (const entry of value) {
    if (
      typeof entry === "string" &&
      allowed.includes(entry as ObligationResumeEvent)
    ) {
      result.push(entry as ObligationResumeEvent);
    }
  }
  return result;
}

export function subscribeToDroidStream({
  input,
  client,
  onObligation,
  onResume,
  onEvent,
  onError,
  onComplete,
}: DroidStreamOptions) {
  const harness = getTestHarness();
  if (harness) {
    return harness.subscribe({
      input,
      client,
      onObligation,
      onResume,
      onEvent,
      onError,
      onComplete,
    });
  }
  // tRPC v11 subscription API
  const subscription = client.droid.stream.subscribe(input, {
    onData(event) {
      const typedEvent = event as RawDroidStreamEvent;
      const normalized = normalizeEvent(typedEvent);
      if (!normalized) {
        return;
      }

      if (normalized.type === "obligation") {
        onObligation?.(normalized);
      }
      if (normalized.type === "resume") {
        onResume?.(normalized);
      }

      onEvent?.(normalized);
    },
    onError(err: unknown) {
      const normalizedError =
        err instanceof Error ? err : new Error(String(err));
      const message = formatCodexErrorMessage(normalizedError.message);
      const finalError =
        message === normalizedError.message
          ? normalizedError
          : new Error(message);
      if (finalError !== normalizedError) {
        (finalError as { cause?: unknown }).cause = normalizedError;
      }
      if (onError) {
        onError(finalError);
      } else {
        toast.error(`Droid stream failed: ${message}`);
      }
    },
    onComplete() {
      onComplete?.();
    },
  });
  return subscription;
}

declare global {
  // eslint-disable-next-line no-var
  var __droidStreamTestHarness__: DroidStreamTestHarness | undefined;
}

function normalizeEvent(event: RawDroidStreamEvent): DroidStreamEvent | null {
  if (event.type === "stdout" || event.type === "stderr") {
    return { type: event.type, data: event.data ?? "" };
  }

  if (event.type === "exit") {
    return { type: "exit", code: Number(event.code ?? 0) };
  }

  if (event.type === "notice") {
    const payload = event as { message?: string; data?: string };
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.data === "string"
          ? payload.data
          : "";
    return { type: "notice", message };
  }

  if (event.type === "obligation") {
    try {
      const parsed = JSON.parse(event.data ?? "{}");
      const runId = String(parsed.runId ?? "");
      if (!runId) {
        return null;
      }
      const obligations = normalizeObligations(parsed.obligations);
      const resumeEvents = normalizeResumeEvents(parsed.resumeEvents);
      return { type: "obligation", runId, obligations, resumeEvents };
    } catch (_error) {
      return null;
    }
  }

  if (event.type === "resume") {
    try {
      const parsed = JSON.parse(event.data ?? "{}");
      const runId = String(parsed.runId ?? "");
      if (!runId) {
        return null;
      }
      return { type: "resume", runId };
    } catch (_error) {
      return null;
    }
  }

  return null;
}
