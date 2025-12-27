import type { RunId, SessionId } from "./id";

/**
 * Discriminates between different actors in the ALFRED ecosystem.
 */
export type EventSource =
  | { _: "user"; sessionId: SessionId; userId?: string }
  | { _: "agent"; agentId: string; runId: RunId }
  | { _: "tool"; toolName: string; callId: string }
  | { _: "system"; component: string };
