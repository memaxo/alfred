import type { AppRouter } from "@alfred/api/routers";
import type { createTRPCProxyClient } from "@trpc/client";

import {
  parseThreadEvent,
  type ThreadEvent,
  type ThreadItem,
} from "@alfred/protocol";
import { toast } from "sonner";

import { formatCodexErrorMessage } from "@/lib/codex-errors";

export type CodexStreamEvent =
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "notice"; message: string; usage?: unknown }
  | { type: "thread_event"; event: ThreadEvent }
  | { type: "thread_item"; item: ThreadItem }
  | {
      type: "complete";
      result: string;
      artifacts?: { path: string; kind: string }[];
    }
  | { type: "error"; message: string; code: string; correlationId: string };

type RawCodexStreamEvent =
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "notice"; message: string; usage?: unknown }
  | { type: "codex_event"; event: unknown }
  | {
      type: "complete";
      result: string;
      artifacts?: { path: string; kind: string }[];
    }
  | { type: "error"; message: string; code: string; correlationId: string };

export interface CodexRunInput {
  prompt: string;
  auto: "read" | "low" | "medium" | "high";
  authz?: string;
  sessionId?: string;
  cw?: string;
  model?: string;
  profile?: string;
  outputSchema?: Record<string, unknown>;
  context?: {
    linearIssueId?: string;
    linearSessionId?: string;
    linearSpace?: string;
    linearAuthz?: string;
    relevantFiles?: string[];
  };
  env?: Record<string, string>;
  timeoutSec?: number;
}

export interface CodexStreamOptions {
  input: CodexRunInput;
  client: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
  onEvent?: (event: CodexStreamEvent) => void;
  onThreadEvent?: (event: ThreadEvent) => void;
  onThreadItem?: (item: ThreadItem) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: {
    result: string;
    artifacts?: { path: string; kind: string }[];
  }) => void;
}

interface CodexStreamTestHarness {
  subscribe: (options: CodexStreamOptions) => { unsubscribe: () => void };
}

function getTestHarness(): CodexStreamTestHarness | null {
  if (typeof globalThis === "undefined") {
    return null;
  }
  const scope = globalThis as {
    __codexStreamTestHarness__?: CodexStreamTestHarness;
  };
  return scope.__codexStreamTestHarness__ ?? null;
}

function normalizeEvent(raw: RawCodexStreamEvent): CodexStreamEvent | null {
  if (raw.type === "stdout" || raw.type === "stderr") {
    return { type: raw.type, text: raw.text ?? "" };
  }

  if (raw.type === "notice") {
    return { type: "notice", message: raw.message ?? "", usage: raw.usage };
  }

  if (raw.type === "codex_event") {
    const threadEvent = parseThreadEvent(raw.event);
    if (threadEvent) {
      return { type: "thread_event", event: threadEvent };
    }
    return null;
  }

  if (raw.type === "complete") {
    return {
      type: "complete",
      result: raw.result,
      artifacts: raw.artifacts,
    };
  }

  if (raw.type === "error") {
    return {
      type: "error",
      message: raw.message,
      code: raw.code,
      correlationId: raw.correlationId,
    };
  }

  return null;
}

export function subscribeToCodexStream({
  input,
  client,
  onEvent,
  onThreadEvent,
  onThreadItem,
  onError,
  onComplete,
}: CodexStreamOptions) {
  const harness = getTestHarness();
  if (harness) {
    return harness.subscribe({
      input,
      client,
      onEvent,
      onThreadEvent,
      onThreadItem,
      onError,
      onComplete,
    });
  }

  const subscription = client.codex.stream.subscribe(input, {
    onData(event) {
      const normalized = normalizeEvent(event as RawCodexStreamEvent);
      if (!normalized) {
        return;
      }

      onEvent?.(normalized);

      if (normalized.type === "thread_event") {
        onThreadEvent?.(normalized.event);
        if (
          normalized.event.type === "item.started" ||
          normalized.event.type === "item.updated" ||
          normalized.event.type === "item.completed"
        ) {
          onThreadItem?.(normalized.event.item);
        }
      }

      if (normalized.type === "complete") {
        onComplete?.({
          result: normalized.result,
          artifacts: normalized.artifacts,
        });
      }
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
        toast.error(`Codex stream failed: ${message}`);
      }
    },
    onComplete() {
      // Stream completed without explicit complete event
    },
  });
  return subscription;
}

declare global {
  // eslint-disable-next-line no-var
  var __codexStreamTestHarness__: CodexStreamTestHarness | undefined;
}
