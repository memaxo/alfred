import { type WorkflowEvent, type WorkflowState } from "@alfred/type/plan";
import {
  type Snapshot,
  type SnapshotReconstructor,
} from "@alfred/type/reconstruct";

/**
 * Reconstructs WorkflowState from event streams.
 */
export class WorkflowReconstructor implements SnapshotReconstructor<
  WorkflowState,
  WorkflowEvent
> {
  readonly initialState: WorkflowState = {
    agents: {},
    phases: {},
    progress: 0,
    status: "idle",
  };

  reduce(state: WorkflowState, event: WorkflowEvent): WorkflowState {
    const next = { ...state };

    switch (event._) {
      case "progress": {
        next.status = "running";
        if (event.pct !== undefined) {
          next.progress = event.pct;
        }
        if (event.message !== undefined) {
          next.message = event.message;
        }
        if (event.message === "completed") {
          next.status = "completed";
          next.progress = 100;
        }
        break;
      }

      case "phase-start": {
        next.status = "running";
        next.currentPhaseId = event.phaseId;
        next.phases = {
          ...next.phases,
          [event.phaseId]: {
            status: "running",
            progress: 0,
          },
        };
        break;
      }

      case "phase-complete": {
        next.phases = {
          ...next.phases,
          [event.phaseId]: {
            status: "completed",
            progress: 100,
            result: event.result,
          },
        };
        if (next.currentPhaseId === event.phaseId) {
          next.currentPhaseId = undefined;
        }
        break;
      }

      case "phase-progress": {
        const existing = next.phases[event.phaseId];
        if (existing) {
          next.phases = {
            ...next.phases,
            [event.phaseId]: {
              ...existing,
              progress: event.progress,
            },
          };
        }
        break;
      }

      case "agent-start": {
        next.currentAgentId = event.agentId;
        next.agents = {
          ...next.agents,
          [event.agentId]: {
            status: "running",
          },
        };
        break;
      }

      case "agent-complete": {
        next.agents = {
          ...next.agents,
          [event.agentId]: {
            status: "completed",
            result: event.result,
          },
        };
        if (next.currentAgentId === event.agentId) {
          next.currentAgentId = undefined;
        }
        break;
      }

      case "obligation": {
        next.status = "suspended";
        break;
      }

      case "error": {
        next.status = "failed";
        next.error = event.message;
        break;
      }
    }

    return next;
  }

  reconstruct(events: Iterable<WorkflowEvent>): WorkflowState {
    let state = this.initialState;
    for (const event of events) {
      state = this.reduce(state, event);
    }
    return state;
  }

  reconstructAt(events: WorkflowEvent[], eventId: string): WorkflowState {
    let state = this.initialState;
    for (const event of events) {
      state = this.reduce(state, event);
      if (event.eventId === eventId) {
        break;
      }
    }
    return state;
  }

  reconstructFromSnapshot(
    snapshot: Snapshot<WorkflowState> | null,
    eventsSinceSnapshot: Iterable<WorkflowEvent>
  ): WorkflowState {
    let state = snapshot ? snapshot.state : this.initialState;
    for (const event of eventsSinceSnapshot) {
      state = this.reduce(state, event);
    }
    return state;
  }
}
