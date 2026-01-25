import type { PipelineEvent, PipelineObserver } from "@alfred/pipeline";
import type {
  AgentEscalateEvent,
  AgentSpawnEvent,
  AgentStuckEvent,
  HookContext,
  HookRegistry,
  WorkflowCompleteEvent,
  WorkflowErrorEvent,
  WorkflowResumeEvent,
  WorkflowStartEvent,
  WorkflowSuspendEvent,
} from "@alfred/type";

interface HooksObserverOptions {
  readonly registry: HookRegistry;
  readonly ctx: HookContext;
}

export class HooksObserver implements PipelineObserver {
  private readonly registry: HookRegistry;
  private readonly baseCtx: HookContext;
  private workflowId: string | undefined;
  private chain: Promise<void> = Promise.resolve();

  constructor(options: HooksObserverOptions) {
    this.registry = options.registry;
    this.baseCtx = options.ctx;
  }

  onEvent(event: PipelineEvent): void {
    this.chain = this.chain
      .then(async () => {
        const hookEvent = mapPipelineEvent(event, this.workflowId);
        if (!hookEvent) {
          return;
        }

        if (hookEvent.type === "workflow:start") {
          this.workflowId = hookEvent.workflowId;
        }

        const ctx: HookContext = {
          ...this.baseCtx,
          workflowId: this.workflowId ?? this.baseCtx.workflowId,
        };

        await this.registry.emit(hookEvent, ctx);
      })
      .catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.baseCtx.log.warn("hooks_observer_error", { error: msg });
      });
  }

  flush(): Promise<void> {
    return this.chain;
  }
}

function mapPipelineEvent(
  event: PipelineEvent,
  currentWorkflowId: string | undefined
):
  | WorkflowStartEvent
  | WorkflowSuspendEvent
  | WorkflowResumeEvent
  | WorkflowCompleteEvent
  | WorkflowErrorEvent
  | AgentSpawnEvent
  | AgentStuckEvent
  | AgentEscalateEvent
  | null {
  switch (event.type) {
    case "pipeline:start": {
      return {
        type: "workflow:start",
        workflowId: event.runId,
        projectId: undefined,
        taskSummary: event.requirement,
      };
    }

    case "pipeline:suspend": {
      return {
        type: "workflow:suspend",
        workflowId: currentWorkflowId ?? "unknown",
        reason: mapSuspendReason(event.reason),
      };
    }

    case "pipeline:resume": {
      return {
        type: "workflow:resume",
        workflowId: currentWorkflowId ?? "unknown",
        bioTicketValid: true,
      };
    }

    case "pipeline:complete": {
      return {
        type: "workflow:complete",
        workflowId: event.summary.runId,
        status: "completed",
        durationMs: event.summary.totalDurationMs,
        stageCount: event.summary.stages.length,
      };
    }

    case "pipeline:failed": {
      return {
        type: "workflow:error",
        workflowId: currentWorkflowId ?? "unknown",
        error: event.error,
        stage: event.lastStage,
        recoverable: false,
      };
    }

    case "agent:spawn": {
      return {
        type: "agent:spawn",
        agentId: event.agentId,
        agentType: "pipeline",
        prompt: event.taskId,
        model: "unknown",
      };
    }

    case "agent:stuck": {
      return {
        type: "agent:stuck",
        reason: event.reason,
        loopCount: event.reason === "loop_detected" ? 1 : 0,
        entropyScore: 0,
      };
    }

    case "agent:escalate-request": {
      return {
        type: "agent:escalate",
        reason: String(event.reason),
        details: event.details,
        suggestions: event.suggestions ?? [],
        severity: event.severity === "blocking" ? "high" : "medium",
      };
    }

    case "agent:escalated": {
      return {
        type: "agent:escalate",
        reason: event.reason,
        details: event.reason,
        suggestions: [],
        severity: "medium",
      };
    }

    default: {
      return null;
    }
  }
}

function mapSuspendReason(reason: string): WorkflowSuspendEvent["reason"] {
  const r = reason.toLowerCase();
  if (r.includes("biometric") || r.includes("passkey") || r.includes("mfa")) {
    return "biometric_required";
  }
  if (r.includes("scope") || r.includes("permission") || r.includes("auth")) {
    return "scope_required";
  }
  return "user_pause";
}
