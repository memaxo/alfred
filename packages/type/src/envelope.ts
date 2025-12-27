export type EventEnvelope<T> = {
  v: 1;
  id: string;
  type: string;
  createdAt: string;
  resource?: string;
  data: T;
};

/** Event source discriminated union (follows ALFRED's `_` pattern) */
export type EventSource =
  | { _: "user"; sessionId: string }
  | { _: "agent"; agentId: string; runId: string }
  | { _: "system"; component: string }
  | { _: "tool"; toolName: string; callId: string };

// NEW: Debug-Enhanced Event Envelope
export type DebugEventEnvelope<T> = EventEnvelope<T> & {
  // ─── CAUSALITY ──────────────────────────────────────────────────────
  /** Parent event that caused this (null for genesis events) */
  parentId?: string | null;

  /** Root workflow/session this event belongs to */
  rootId?: string;

  // ─── ORDERING ───────────────────────────────────────────────────────
  /** Monotonic sequence within the run (like codex_events.seq) */
  seq?: number;

  /** Lamport timestamp for cross-run ordering (optional) */
  lamport?: number;

  // ─── PROVENANCE ─────────────────────────────────────────────────────
  /** What entity produced this event */
  source?: EventSource;
};
