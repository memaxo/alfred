import type { PipelineEvent } from "@alfred/pipeline";

import { logger } from "@alfred/logger";

export interface PersistedWorkflowEvent {
  eventType: import("@alfred/db/schema/workflow").WorkflowEventType;
  data: Record<string, unknown>;
}

export function mapPipelineEventToWorkflowEvent(
  event: PipelineEvent
): PersistedWorkflowEvent | null {
  switch (event.type) {
    case "pipeline:start": {
      return {
        eventType: "run",
        data: {
          kind: "pipeline_start",
          runId: event.runId,
          requirement: event.requirement,
        },
      };
    }
    case "stage:enter": {
      return {
        eventType: "step-start",
        data: { kind: "stage_enter", stage: event.stage },
      };
    }
    case "stage:exit": {
      return {
        eventType: "step-complete",
        data: {
          kind: "stage_exit",
          stage: event.stage,
          durationMs: event.durationMs,
        },
      };
    }
    case "stage:error": {
      return {
        eventType: "error",
        data: {
          kind: "stage_error",
          stage: event.stage,
          message: event.error,
        },
      };
    }
    case "agent:spawn": {
      return {
        eventType: "agent-start",
        data: {
          kind: "agent_spawn",
          agentId: event.agentId,
          taskId: event.taskId,
        },
      };
    }
    case "agent:complete": {
      return {
        eventType: "agent-complete",
        data: {
          kind: "agent_complete",
          agentId: event.agentId,
          outcome: event.outcome,
        },
      };
    }
    case "agent:escalate-request": {
      return {
        eventType: "notice",
        data: {
          kind: "escalation",
          agentId: event.agentId,
          reason: event.reason,
          details: event.details,
          suggestions: event.suggestions,
          severity: event.severity,
          timestamp: event.timestamp,
        },
      };
    }
    case "pipeline:suspend": {
      return {
        eventType: "suspend",
        data: { kind: "pipeline_suspend", reason: event.reason },
      };
    }
    case "pipeline:resume": {
      return {
        eventType: "resume",
        data: { kind: "pipeline_resume", fromStage: event.fromStage },
      };
    }
    case "pipeline:complete": {
      return {
        eventType: "finish",
        data: {
          kind: "pipeline_complete",
          summary: event.summary,
          summaryText: event.summaryText,
        },
      };
    }
    case "pipeline:failed": {
      return {
        eventType: "error",
        data: {
          kind: "pipeline_failed",
          lastStage: event.lastStage,
          message: event.error,
        },
      };
    }

    default: {
      return null;
    }
  }

  return null;
}

export function createPipelineEventPersister(args: {
  runId: string;
  wrapEventEnvelope: (args: {
    id: string;
    type: import("@alfred/db/schema/workflow").WorkflowEventType;
    resource: "user";
    data: Record<string, unknown>;
  }) => unknown;
  workflowRepo: {
    appendEvent: (args: {
      eventData: unknown;
      eventType: import("@alfred/db/schema/workflow").WorkflowEventType;
      runId: string;
      timestamp: Date;
    }) => Promise<unknown>;
  };
}) {
  const tasks = new Set<Promise<void>>();

  const persist = (event: PipelineEvent): void => {
    // Skip high-volume chatter
    if (event.type === "stage:progress" || event.type === "agent:progress") {
      return;
    }

    const mapped = mapPipelineEventToWorkflowEvent(event);
    if (!mapped) {
      return;
    }

    const p = args.workflowRepo
      .appendEvent({
        eventData: args.wrapEventEnvelope({
          id: crypto.randomUUID(),
          type: mapped.eventType,
          resource: "user",
          data: mapped.data,
        }),
        eventType: mapped.eventType,
        runId: args.runId,
        timestamp: new Date(event.timestamp),
      })
      .then(() => {})
      .catch((error) => {
        logger.warn("workflow_pipeline_event_persist_failed", {
          error: error instanceof Error ? error.message : String(error),
          eventType: event.type,
          runId: args.runId,
        });
      })
      .finally(() => {
        tasks.delete(p);
      });

    tasks.add(p);
  };

  const flush = async (): Promise<void> => {
    if (tasks.size === 0) {
      return;
    }
    await Promise.allSettled(tasks);
  };

  return { flush, persist };
}
