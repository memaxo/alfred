import type { PipelineEvent } from "./events";
import type { PipelineConfig, PipelineContext } from "./pipeline";
import {
  assertSerializable,
  fromSerializable,
  type SerializableValue,
  toSerializable,
} from "./snapshot";

export type ContextOptions = {
  runId: string;
  requirement: string;
  workspace: string;
  userId: string;
  signal?: AbortSignal;
  config: PipelineConfig;
  emit: (event: PipelineEvent) => void;
  /** Initial context entries for resume (from snapshot.contextEntries) */
  initialContext?: [string, SerializableValue][];
  /** Callback when context is set (for checkpointing) */
  onContextSet?: (key: string, value: SerializableValue) => void;
  /** Whether to emit context:set events (default: true) */
  emitContextEvents?: boolean;
};

export function createPipelineContext(
  options: ContextOptions
): PipelineContext {
  const storage = new Map<string, unknown>();
  const signal = options.signal ?? new AbortController().signal;
  const emitContextEvents = options.emitContextEvents ?? true;

  // Restore initial context if provided (for resume)
  if (options.initialContext) {
    for (const [key, value] of options.initialContext) {
      storage.set(key, value);
    }
  }

  return {
    runId: options.runId,
    requirement: options.requirement,
    workspace: options.workspace,
    userId: options.userId,
    signal,
    config: options.config,
    emit: options.emit,
    get: <T>(key: string) => {
      const value = storage.get(key);
      if (value === undefined) {
        return;
      }
      return fromSerializable(value as SerializableValue) as T;
    },
    set: (key, value) => {
      // Convert to serializable format first (handles Map, Set, Date)
      const serializable = toSerializable(value);

      // Validate serializability after conversion
      assertSerializable(key, serializable);

      storage.set(key, serializable);

      // Emit context:set event for reconstruction
      if (emitContextEvents) {
        options.emit({
          type: "context:set",
          key,
          value: serializable,
          timestamp: Date.now(),
        });
      }

      // Notify checkpoint observer
      options.onContextSet?.(key, serializable);
    },
  };
}

/**
 * Export storage from context for snapshot creation.
 * Returns entries as serializable array.
 */
export function exportContextStorage(
  ctx: PipelineContext
): [string, SerializableValue][] {
  const entries: [string, SerializableValue][] = [];
  // Access internal storage via closure
  // This is a read-only operation for checkpointing
  const keys = [
    "subtasks",
    "execPlans",
    "waves",
    "trackerState",
    "reviewGateState",
    "fixAttempts",
    "linearSessionId",
    "executeOutput",
    "fileChanges",
  ];

  for (const key of keys) {
    const value = ctx.get<SerializableValue>(key);
    if (value !== undefined) {
      entries.push([key, value]);
    }
  }

  return entries;
}
