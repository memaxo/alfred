/**
 * State Reconstruction Interface
 *
 * Generalizes the event sourcing pattern used in cognitive state reconstruction.
 *
 * This interface enables:
 * - Deterministic replay of event streams
 * - Point-in-time state reconstruction
 * - Snapshot-first optimization for performance
 *
 * Reference implementation: packages/runtime/src/loops/cognitive.ts
 *
 * @example
 * ```typescript
 * const reconstructor = new CognitiveReconstructor();
 * const state = reconstructor.reconstruct(events);
 * const stateAtEvent = reconstructor.reconstructAt(events, eventId);
 * ```
 */

/**
 * Generic interface for reconstructing state from event streams.
 *
 * @template S - The state type (e.g., CognitiveState, WorkflowState)
 * @template E - The event type (e.g., Event, WorkflowEvent)
 */
export type StateReconstructor<S, E> = {
  /** Initial state before any events are applied */
  readonly initialState: S;

  /**
   * Pure reducer function: applies a single event to state.
   * Must be deterministic and side-effect free.
   *
   * @param state - Current state
   * @param event - Event to apply
   * @returns New state after applying the event
   */
  reduce(state: S, event: E): S;

  /**
   * Reconstructs state from a complete event stream.
   *
   * Implementation should:
   * 1. Start with initialState
   * 2. Apply each event in order using reduce()
   * 3. Return final state
   *
   * @param events - Iterable sequence of events (must be ordered)
   * @returns Final state after applying all events
   */
  reconstruct(events: Iterable<E>): S;

  /**
   * Reconstructs state at a specific point in the event stream.
   *
   * Stops at the event with the given eventId and returns the state
   * after applying that event.
   *
   * @param events - Iterable sequence of events (must be ordered)
   * @param eventId - ID of the event to stop at
   * @returns State after applying events up to and including eventId
   */
  reconstructAt(events: Iterable<E>, eventId: string): S;
};

/**
 * Helper type for snapshot-based reconstruction.
 *
 * Snapshots store state + lastEventId to enable efficient reconstruction:
 * - Load snapshot state
 * - Replay only events after snapshot.createdAt
 *
 * This pattern is used in cognitive state reconstruction.
 */
export type Snapshot<S> = {
  id: string;
  state: S;
  lastEventId: string;
  createdAt: Date;
};

/**
 * Snapshot-first reconstruction strategy.
 *
 * This is the recommended pattern for efficient state reconstruction:
 * 1. Try to load latest snapshot
 * 2. If snapshot exists, start from snapshot.state and replay events since snapshot.createdAt
 * 3. If no snapshot, start from initialState and replay all events
 *
 * Reference: packages/runtime/src/loops/cognitive.ts lines 64-76
 */
export type SnapshotReconstructor<S, E> = StateReconstructor<S, E> & {
  /**
   * Reconstructs state using snapshot-first optimization.
   *
   * @param snapshot - Latest snapshot (or null if none exists)
   * @param eventsSinceSnapshot - Events that occurred after snapshot.createdAt
   * @returns Reconstructed state
   */
  reconstructFromSnapshot(
    snapshot: Snapshot<S> | null,
    eventsSinceSnapshot: Iterable<E>
  ): S;
};
