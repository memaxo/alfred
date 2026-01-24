import type { WorkflowEvent } from "@alfred/type/plan";

import type { PipelineEvent } from "../events";
import type { PipelineObserver } from "../runner";

type EventCallback = (event: WorkflowEvent) => void;

export class WorkflowEventObserver implements PipelineObserver {
  private readonly callback: EventCallback;

  constructor(callback: EventCallback) {
    this.callback = callback;
  }

  onEvent(event: PipelineEvent): void {
    // Convert pipeline events to workflow events for backwards compatibility
    const workflowEvent = this.toWorkflowEvent(event);
    if (workflowEvent) {
      this.callback(workflowEvent);
    }
  }

  private toWorkflowEvent(event: PipelineEvent): WorkflowEvent | null {
    switch (event.type) {
      case "stage:enter":
        return { _: "step-start", phase: event.stage };

      case "stage:exit":
        return { _: "step-complete", phase: event.stage };

      case "stage:progress":
        return {
          _: "progress",
          phase: event.stage,
          message: event.message,
        };

      case "agent:spawn":
        return {
          _: "agent-start",
          agentId: event.agentId,
          phaseId: "execute",
          taskId: event.taskId,
        };

      case "agent:complete":
        return {
          _: "agent-complete",
          agentId: event.agentId,
          phaseId: "execute",
          status: event.outcome.status,
          durationMs: event.outcome.durationMs,
        };

      case "pipeline:complete":
        return {
          _: "workflow-complete",
          runId: event.summary.runId,
          summary: event.summary,
        };

      case "pipeline:failed":
        return {
          _: "error",
          message: event.error,
          phase: event.lastStage,
        };

      default:
        return null;
    }
  }
}
