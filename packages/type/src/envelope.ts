import type { EventId, RunId } from "./id";
import type { EventSource } from "./source";

/**
 * The standard atom of information in ALFRED.
 * Enhanced with causal and ordering fields for the TUI Debugger.
 */
export interface EventEnvelope<T = unknown> {
  /** Schema version */
  v: number;

  /** Unique identity (ULID or deterministic hash) */
  id: EventId;

  /** Domain-specific event type */
  type: string;

  /** ISO timestamp */
  createdAt: string;

  /** The payload of the event */
  data: T;

  // --- CAUSAL & CONTEXTUAL (NEW) ---

  /** Optional resource scope */
  resource?: string;

  /** Root workflow run this event belongs to */
  rootId?: RunId;

  /** The event that caused this one (parent link) */
  parentId?: EventId | null;

  /** Monotonic sequence number within the rootId context */
  seq?: number;

  /** The actor that produced this event */
  source?: EventSource;
}
