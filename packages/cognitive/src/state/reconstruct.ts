import {
  type Snapshot,
  type SnapshotReconstructor,
} from "@alfred/type/reconstruct";

import { applyTransition } from "../transition";
import { idle, initialAutonomy } from "./factory";
import {
  type AutonomyGradient,
  type CognitiveState,
  type Event,
} from "./types";

/**
 * Reconstructs CognitiveState from event streams.
 */
export class CognitiveReconstructor implements SnapshotReconstructor<
  CognitiveState & { autonomy: AutonomyGradient },
  Event
> {
  readonly initialState: CognitiveState & { autonomy: AutonomyGradient };

  constructor(now: number = Date.now()) {
    this.initialState = {
      ...idle(now),
      autonomy: initialAutonomy(now),
    };
  }

  reduce(
    state: CognitiveState & { autonomy: AutonomyGradient },
    event: Event
  ): CognitiveState & { autonomy: AutonomyGradient } {
    const result = applyTransition(state, state.autonomy, event);
    return {
      ...result.state,
      autonomy: result.autonomy,
    };
  }

  reconstruct(
    events: Iterable<Event>
  ): CognitiveState & { autonomy: AutonomyGradient } {
    let state = this.initialState;
    for (const event of events) {
      state = this.reduce(state, event);
    }
    return state;
  }

  reconstructAt(
    events: Event[]
  ): CognitiveState & { autonomy: AutonomyGradient } {
    let state = this.initialState;
    // Note: Cognitive Event type doesn't have an ID internally,
    // it's usually wrapped in an envelope. This assumes the events passed
    // are either envelopes or we need to match some other way.
    // For now, we assume the caller provides events that can be matched.
    // Note: Improve Event type to include ID or handle envelopes.
    for (const event of events) {
      state = this.reduce(state, event);
      // If we had IDs on events, we would check here.
    }
    return state;
  }

  reconstructFromSnapshot(
    snapshot: Snapshot<CognitiveState & { autonomy: AutonomyGradient }> | null,
    eventsSinceSnapshot: Iterable<Event>
  ): CognitiveState & { autonomy: AutonomyGradient } {
    let state = snapshot ? snapshot.state : this.initialState;
    for (const event of eventsSinceSnapshot) {
      state = this.reduce(state, event);
    }
    return state;
  }
}
