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
 * Only allows primitive types, arrays, and plain objects.
 * Rejects class instances (Map, Set, Date), functions, and undefined.
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
  if (typeof value === "function" || typeof value === "undefined") {
    return false;
  }
  // Check for Map, Set, Date using multiple methods for transpiled code
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    return false;
  }
  // Additional check for Map and Set using constructor name
  const constructorName = value?.constructor?.name;
  if (
    constructorName === "Map" ||
    constructorName === "Set" ||
    constructorName === "Date"
  ) {
    return false;
  }
  // Check for Map-like objects with get/set methods
  if (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    "set" in value &&
    "size" in value &&
    typeof (value as { get?: unknown }).get === "function" &&
    typeof (value as { set?: unknown }).set === "function" &&
    typeof (value as { size?: unknown }).size === "number"
  ) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.every(isSerializable);
  }
  if (typeof value === "object") {
    // Only allow plain objects (not class instances)
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return false;
    }
    return Object.values(value).every(isSerializable);
  }
  return false;
}

/**
 * Convert complex types (Map, Set, Date) to JSON-safe plain objects.
 */
export function toSerializable(value: unknown): SerializableValue {
  // JSON cannot represent undefined; normalize to null
  if (typeof value === "undefined") {
    return null;
  }
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

/**
 * Get the previous stage in the pipeline order.
 */
export function getPreviousStage(stage: StageName): StageName | null {
  const index = STAGE_ORDER.indexOf(stage);
  if (index <= 0) {
    return null;
  }
  return STAGE_ORDER[index - 1] as StageName;
}

/**
 * Get the next stage in the pipeline order.
 */
export function getNextStage(stage: StageName): StageName | null {
  const index = STAGE_ORDER.indexOf(stage);
  if (index === -1 || index >= STAGE_ORDER.length - 1) {
    return null;
  }
  return STAGE_ORDER[index + 1] as StageName;
}

/**
 * Extract the output of a specific stage from a snapshot.
 * Returns the stage output if it exists, null otherwise.
 *
 * @param snapshot - Pipeline snapshot
 * @param stage - Stage whose output to extract
 * @returns Stage output or null if not available
 */
export function extractStageOutput<T = unknown>(
  snapshot: PipelineSnapshot,
  stage: StageName
): T | null {
  const ctxMap = new Map(snapshot.contextEntries);
  const output = ctxMap.get(`${stage}Output`);
  if (output === undefined) {
    return null;
  }
  return fromSerializable(output as SerializableValue) as T;
}

/**
 * Extract typed stage input from a snapshot.
 * The input for a stage is the output of the previous stage.
 *
 * @param snapshot - Pipeline snapshot
 * @param stage - Stage whose input to extract
 * @returns Input for the stage (previous stage's output) or null
 */
export function extractStageInput<T = unknown>(
  snapshot: PipelineSnapshot,
  stage: StageName
): T | null {
  const previousStage = getPreviousStage(stage);
  if (!previousStage) {
    // First stage (init) - input is the PipelineInput, not stored in context
    return null;
  }
  return extractStageOutput<T>(snapshot, previousStage);
}

/**
 * Options for creating a PipelineContext from a snapshot.
 */
export type CreateContextFromSnapshotOptions = {
  /** Function to emit pipeline events */
  emit: (event: PipelineEvent) => void;
  /** Optional abort signal for cancellation */
  signal?: AbortSignal;
  /** Pipeline configuration override */
  config?: Partial<import("./pipeline").PipelineConfig>;
};

/**
 * Create a minimal PipelineContext from a snapshot for single-stage execution.
 * Useful for resuming execution or running individual stages.
 *
 * @param snapshot - Pipeline snapshot to reconstruct context from
 * @param options - Context creation options
 * @returns Reconstructed PipelineContext
 */
export function createContextFromSnapshot(
  snapshot: PipelineSnapshot,
  options: CreateContextFromSnapshotOptions
): import("./pipeline").PipelineContext {
  const ctxMap = new Map(snapshot.contextEntries);

  // Extract core context values
  const workspace =
    (ctxMap.get("workspace") as string | undefined) ?? process.cwd();
  const userId = (ctxMap.get("userId") as string | undefined) ?? "";

  // Import createPipelineContext dynamically to avoid circular deps
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createPipelineContext } = require("./context") as {
    createPipelineContext: typeof import("./context").createPipelineContext;
  };
  const { DEFAULT_CONFIG } = require("./pipeline") as {
    DEFAULT_CONFIG: import("./pipeline").PipelineConfig;
  };

  const config = { ...DEFAULT_CONFIG, ...options.config };

  return createPipelineContext({
    runId: snapshot.runId,
    requirement: snapshot.requirement,
    workspace,
    userId,
    config,
    signal: options.signal,
    emit: options.emit,
    initialContext: snapshot.contextEntries,
    emitContextEvents: true,
  });
}

/**
 * Check if a snapshot has completed a specific stage.
 */
export function hasCompletedStage(
  snapshot: PipelineSnapshot,
  stage: StageName
): boolean {
  const stageIndex = STAGE_ORDER.indexOf(stage);
  return snapshot.lastCompletedStageIndex >= stageIndex;
}

/**
 * Get the stage to resume from (the next uncompleted stage).
 */
export function getResumeStage(snapshot: PipelineSnapshot): StageName | null {
  if (snapshot.lastCompletedStageIndex >= STAGE_ORDER.length - 1) {
    return null; // All stages completed
  }
  return STAGE_ORDER[snapshot.lastCompletedStageIndex + 1] as StageName;
}
