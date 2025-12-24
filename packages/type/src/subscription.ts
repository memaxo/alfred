/**
 * Subscription protocol types for cursor-based real-time sync.
 *
 * Design principles:
 * - Cursor-based resume: Every event includes monotonic cursor
 * - Idempotent merge: Events keyed by id, re-applying is no-op
 * - Snapshot vs delta: On reconnect, delta if cursor valid, snapshot if stale
 * - Single WebSocket: Multiplexed streams over one connection
 */

/**
 * Base subscription event with cursor for resumability.
 */
export type SubscriptionEvent<T> = {
  type: "delta" | "snapshot";
  cursor: string;
  seq: number;
  timestamp: string;
  payload: T;
};

/**
 * Edge resource for graph subscriptions.
 */
export type EdgeResource = {
  id: string;
  fromId: string;
  toId: string;
  kind: string;
  label?: string | null;
  weight?: number | null;
  resource: string;
  created: string;
};

/**
 * Graph subscription event payloads.
 */
export type GraphEventPayload =
  | { action: "edge_created"; edge: EdgeResource }
  | { action: "edge_deleted"; edgeId: string }
  | { action: "edge_updated"; edge: Partial<EdgeResource> & { id: string } }
  | { action: "edges_snapshot"; edges: EdgeResource[] };

export type GraphEvent = SubscriptionEvent<GraphEventPayload>;

/**
 * Workflow run status.
 */
export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "suspended"
  | "cancelled";

/**
 * Workflow step event (subset of full workflow event).
 */
export type WorkflowStepEvent = {
  id: string;
  type: string;
  data?: unknown;
  timestamp: string;
};

/**
 * Workflow subscription event payloads.
 */
export type WorkflowEventPayload =
  | { action: "run_started"; runId: string; requirement?: string }
  | { action: "run_completed"; runId: string; status: WorkflowRunStatus }
  | { action: "run_failed"; runId: string; error: string }
  | { action: "step"; runId: string; event: WorkflowStepEvent };

export type WorkflowSubscriptionEvent = SubscriptionEvent<WorkflowEventPayload>;

/**
 * Multiplexed stream message envelope.
 */
export type StreamEnvelope<T = unknown> = {
  streamId: string;
  event: SubscriptionEvent<T>;
};

/**
 * Client subscription request.
 */
export type SubscribeRequest = {
  type: "subscribe";
  streamId: string;
  cursor?: string;
};

/**
 * Client unsubscribe request.
 */
export type UnsubscribeRequest = {
  type: "unsubscribe";
  streamId: string;
};

/**
 * WebSocket message types (client to server).
 */
export type ClientMessage = SubscribeRequest | UnsubscribeRequest;

/**
 * WebSocket message types (server to client).
 */
export type ServerMessage<T = unknown> =
  | StreamEnvelope<T>
  | { type: "subscribed"; streamId: string; cursor: string }
  | { type: "unsubscribed"; streamId: string }
  | { type: "error"; streamId?: string; message: string };

/**
 * Subscription state for client-side tracking.
 */
export type SubscriptionState = {
  streamId: string;
  cursor: string | null;
  status: "connecting" | "connected" | "disconnected" | "error";
  lastEventAt: number | null;
};
