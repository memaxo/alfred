/**
 * Pipeline Snapshot and Reconstruction
 *
 * Implements event sourcing for pipeline state, enabling:
 * - Resume from any stage boundary
 * - Point-in-time state reconstruction
 * - Snapshot-first optimization for performance
 *
 * Follows the SnapshotReconstructor<S, E> interface from @alfred/type/reconstruct.
 */

import type { Snapshot, SnapshotReconstructor } from "@alfred/type/reconstruct";
import type { PipelineEvent } from "./events";
import type { StageName } from "./pipeline";
import { STAGE_ORDER } from "./pipeline";

/**
 * Constraint: Only JSON-serializable values allowed in context.
 * This enables reliable persistence and resume.
 */
export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue };

/**
 * Pipeline execution status.
 */
export type PipelineStatus =
  | "idle"
  | "running"
  | "suspended"
  | "completed"
  | "failed";

/**
 * Serializable pipeline snapshot.
 * Contains all state needed to resume execution from any stage boundary.
 *
 * Design constraints:
 * - No class instances (Map, Set, etc.)
 * - All values JSON-serializable
 * - Timestamps for debugging and TTL
 */
export type PipelineSnapshot = {
  /** Run identifier */
  runId: string;
  /** Current execution status */
  status: PipelineStatus;
  /** Original requirement text */
  requirement: string;
  /** Last successfully completed stage (null if none) */
  lastCompletedStage: StageName | null;
  /** Index in STAGE_ORDER of last completed stage (-1 if none) */
  lastCompletedStageIndex: number;
  /** Context entries as array of tuples (Map not JSON-serializable) */
  contextEntries: [string, SerializableValue][];
  /** Stage execution results */
  stageResults: Array<{
    name: StageName;
    durationMs: number;
    status: "success" | "failure" | "skipped";
  }>;
  /** Timestamp when pipeline started */
  startedAt: number;
  /** Timestamp of last event processed */
  lastEventAt: number;
  /** Last event ID for reconstruction */
  lastEventId: string | null;
  /** Error message if failed */
  error: string | null;
};

/**
 * Create initial empty snapshot.
 */
export function createInitialSnapshot(): PipelineSnapshot {
  return {
    runId: "",
    status: "idle",
    requirement: "",
    lastCompletedStage: null,
    lastCompletedStageIndex: -1,
    contextEntries: [],
    stageResults: [],
    startedAt: 0,
    lastEventAt: 0,
    lastEventId: null,
    error: null,
  };
}

/**
 * Check if a value is serializable (JSON-safe).
 * Now supports Map, Set, and Date by allowing them in the initial check,
 * but they must be converted to plain objects/arrays before final serialization.
 */
export function isSerializable(value: unknown): value is SerializableValue {
  if (value === null) {
    return true;
  }
  if (typeof value === "string") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "boolean") {
    return true;
  }
  if (value instanceof Date) {
    return true;
  }
  if (value instanceof Map) {
    return true;
  }
  if (value instanceof Set) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isSerializable);
  }
  if (typeof value === "object") {
    // Allow plain objects and class instances that we know how to serialize
    // or objects that have already been serialized with __type
    return Object.values(value).every(isSerializable);
  }
  return false;
}

/**
 * Convert complex types (Map, Set, Date) to JSON-safe plain objects.
 */
export function toSerializable(value: unknown): SerializableValue {
  if (value === null || typeof value !== "object") {
    return value as SerializableValue;
  }

  if (value instanceof Date) {
    return { __type: "Date", value: value.toISOString() };
  }

  if (value instanceof Map) {
    const entries: [SerializableValue, SerializableValue][] = [];
    for (const [k, v] of value.entries()) {
      entries.push([toSerializable(k), toSerializable(v)]);
    }
    return { __type: "Map", entries };
  }

  if (value instanceof Set) {
    return { __type: "Set", values: Array.from(value).map(toSerializable) };
  }

  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  // Plain object
  const result: Record<string, SerializableValue> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = toSerializable(val);
  }
  return result;
}

/**
 * Restore complex types from their serializable representation.
 */
export function fromSerializable(value: SerializableValue): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(fromSerializable);
  }

  const obj = value as Record<string, unknown>;
  if (obj.__type === "Date") {
    return new Date(obj.value as string);
  }

  if (obj.__type === "Map") {
    const map = new Map();
    for (const [k, v] of obj.entries as [
      SerializableValue,
      SerializableValue,
    ][]) {
      map.set(fromSerializable(k), fromSerializable(v));
    }
    return map;
  }

  if (obj.__type === "Set") {
    return new Set((obj.values as SerializableValue[]).map(fromSerializable));
  }

  // Plain object
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = fromSerializable(val as SerializableValue);
  }
  return result;
}

/**
 * Assert value is serializable, throwing if not.
 */
export function assertSerializable(
  key: string,
  value: unknown
): asserts value is SerializableValue {
  if (!isSerializable(value)) {
    throw new Error(
      `Context value for key "${key}" is not serializable. ` +
        "Only JSON-safe values (string, number, boolean, null, arrays, plain objects) are allowed."
    );
  }
}

/**
 * Generate a unique event ID for tracking.
 */
function generateEventId(event: PipelineEvent): string {
  return `${event.type}:${event.timestamp}`;
}

/**
 * Pipeline state reconstructor implementing SnapshotReconstructor<S, E>.
 *
 * Key properties:
 * - `reduce()` is pure and deterministic
 * - State can be reconstructed from any event stream
 * - Supports snapshot-first optimization
 */
export class PipelineReconstructor
  implements SnapshotReconstructor<PipelineSnapshot, PipelineEvent>
{
  readonly initialState: PipelineSnapshot = createInitialSnapshot();

  /**
   * Pure reducer: applies a single event to state.
   * Must be deterministic and side-effect free.
   */
  reduce(state: PipelineSnapshot, event: PipelineEvent): PipelineSnapshot {
    const next: PipelineSnapshot = {
      ...state,
      contextEntries: [...state.contextEntries],
      stageResults: [...state.stageResults],
      lastEventAt: event.timestamp,
      lastEventId: generateEventId(event),
    };

    switch (event.type) {
      case "pipeline:start":
        next.runId = event.runId;
        next.requirement = event.requirement;
        next.status = "running";
        next.startedAt = event.timestamp;
        break;

      case "stage:enter":
        // Stage entered, status remains running
        next.status = "running";
        break;

      case "stage:exit": {
        // Stage completed successfully
        const stageIndex = STAGE_ORDER.indexOf(event.stage);
        next.lastCompletedStage = event.stage;
        next.lastCompletedStageIndex = stageIndex;
        next.stageResults.push({
          name: event.stage,
          durationMs: event.durationMs,
          status: "success",
        });
        break;
      }

      case "stage:error": {
        // Stage failed
        next.stageResults.push({
          name: event.stage,
          durationMs: 0,
          status: "failure",
        });
        next.status = "failed";
        next.error = event.error;
        break;
      }

      case "context:set":
        // Update context entry (replace if exists)
        next.contextEntries = next.contextEntries.filter(
          ([key]) => key !== event.key
        );
        next.contextEntries.push([event.key, event.value]);
        break;

      case "pipeline:suspend":
        next.status = "suspended";
        break;

      case "pipeline:resume":
        next.status = "running";
        break;

      case "pipeline:complete":
        next.status = "completed";
        break;

      case "pipeline:failed":
        next.status = "failed";
        next.error = event.error;
        break;

      // Agent events don't change snapshot state directly
      // They are tracked via context:set for TrackerContext
      case "agent:spawn":
      case "agent:progress":
      case "agent:complete":
      case "agent:stuck":
      case "agent:escalated":
      case "agent:retry":
        // No snapshot state change
        break;

      // Review events
      case "review:check":
      case "review:fix-start":
      case "review:fix-complete":
        // No snapshot state change (tracked via context)
        break;

      // Learning events
      case "learn:insight":
        // No snapshot state change
        break;

      // Wave events
      case "wave:aborted":
        // No snapshot state change (tracked via context)
        break;

      // Context cache events
      case "context:cache-hit":
        // No snapshot state change
        break;

      // Progress events
      case "stage:progress":
        // No snapshot state change
        break;
    }

    return next;
  }

  /**
   * Reconstruct state from complete event stream.
   */
  reconstruct(events: Iterable<PipelineEvent>): PipelineSnapshot {
    let state = this.initialState;
    for (const event of events) {
      state = this.reduce(state, event);
    }
    return state;
  }

  /**
   * Reconstruct state at a specific event.
   */
  reconstructAt(
    events: Iterable<PipelineEvent>,
    eventId: string
  ): PipelineSnapshot {
    let state = this.initialState;
    for (const event of events) {
      state = this.reduce(state, event);
      if (generateEventId(event) === eventId) {
        break;
      }
    }
    return state;
  }

  /**
   * Reconstruct from snapshot + events since snapshot.
   * This is the performance-optimized path.
   */
  reconstructFromSnapshot(
    snapshot: Snapshot<PipelineSnapshot> | null,
    eventsSinceSnapshot: Iterable<PipelineEvent>
  ): PipelineSnapshot {
    let state = snapshot ? snapshot.state : this.initialState;
    for (const event of eventsSinceSnapshot) {
      state = this.reduce(state, event);
    }
    return state;
  }
}

/**
 * Convert context entries back to Map for use in PipelineContext.
 */
export function contextEntriesToMap(
  entries: [string, SerializableValue][]
): Map<string, SerializableValue> {
  return new Map(entries);
}

/**
 * Convert Map to context entries for serialization.
 */
export function mapToContextEntries(
  map: Map<string, unknown>
): [string, SerializableValue][] {
  const entries: [string, SerializableValue][] = [];
  for (const [key, value] of map) {
    assertSerializable(key, value);
    entries.push([key, value]);
  }
  return entries;
}

/**
 * Create a Snapshot wrapper for persistence.
 */
export function createSnapshot(
  state: PipelineSnapshot
): Snapshot<PipelineSnapshot> {
  return {
    id: `snapshot:${state.runId}:${state.lastCompletedStageIndex}`,
    state,
    lastEventId: state.lastEventId ?? "",
    createdAt: new Date(state.lastEventAt),
  };
}
