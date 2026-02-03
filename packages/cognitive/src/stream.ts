export type StreamSurface =
  | "workflow"
  | "pipeline"
  | "chat"
  | "voice"
  | "reminder"
  | "system";

export interface ResolveStreamIdInput {
  surface: StreamSurface;
  runId?: string;
  threadId?: string;
  userId?: string;
  fallback?: string;
}

/**
 * Resolve a stable cognitive stream id for an execution surface.
 *
 * Notes:
 * - Workflow/pipeline runs should always supply `runId`.
 * - Conversational surfaces should supply `threadId`.
 * - Some system surfaces only have `userId`; those are namespaced.
 */
export function resolveStreamId(input: ResolveStreamIdInput): string {
  const fallback = input.fallback ?? "default";

  switch (input.surface) {
    case "workflow":
    case "pipeline": {
      return input.runId ?? fallback;
    }
    case "chat":
    case "voice": {
      return input.threadId ?? input.runId ?? fallback;
    }
    case "reminder": {
      if (input.userId) {
        return `reminder:${input.userId}`;
      }
      return fallback;
    }
    case "system": {
      if (input.userId) {
        return `system:${input.userId}`;
      }
      return fallback;
    }
  }
}
