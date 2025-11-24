import { toast } from "sonner";
import { createTRPCProxyClient } from "@trpc/client";
import type { AppRouter } from "@alfred/api/routers";
import type { Subscriber } from "@trpc/client";

export type DroidStreamEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "exit"; code: number }
  | { type: "obligation"; runId: string; obligations: string[] }
  | { type: "resume"; runId: string };

type RawDroidStreamEvent =
  | { type: "stdout"; data?: string }
  | { type: "stderr"; data?: string }
  | { type: "exit"; code?: number }
  | { type: "obligation"; data?: string }
  | { type: "resume"; data?: string };

export type DroidStreamOptions = {
  input: {
    prompt: string;
    auto: "read" | "low" | "medium" | "high";
    authz: string;
    out?: "text" | "json" | "debug";
  };
  client: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
  onObligation?: (payload: { runId: string; obligations: string[] }) => void;
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
  const observable = client.droid.stream.subscribe(input);
  return observable.subscribe({
    next(event) {
      const normalized = normalizeEvent(event as RawDroidStreamEvent);
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
    error(err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (onError) {
        onError(error);
      } else {
        toast.error(`Droid stream failed: ${error.message}`);
      }
    },
    complete() {
      onComplete?.();
    },
  } as Subscriber<RawDroidStreamEvent>);
}

declare global {
  // eslint-disable-next-line no-var
  var __droidStreamTestHarness__:
    | DroidStreamTestHarness
    | undefined;
}

function normalizeEvent(event: RawDroidStreamEvent): DroidStreamEvent | null {
  if (event.type === "stdout" || event.type === "stderr") {
    return { type: event.type, data: event.data ?? "" };
  }

  if (event.type === "exit") {
    return { type: "exit", code: Number(event.code ?? 0) };
  }

  if (event.type === "obligation") {
    try {
      const parsed = JSON.parse(event.data ?? "{}");
      const runId = String(parsed.runId ?? "");
      if (!runId) {
        return null;
      }
      const obligations = Array.isArray(parsed.obligations)
        ? parsed.obligations.map(String)
        : [];
      return { type: "obligation", runId, obligations };
    } catch (error) {
      console.error("Failed to parse obligation payload", error);
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
    } catch (error) {
      console.error("Failed to parse resume payload", error);
      return null;
    }
  }

  return null;
}
