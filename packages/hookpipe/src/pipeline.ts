import type { PipelineEvent, PipelineObserver } from "@alfred/pipeline";
import type {
  HookContext,
  HookEvent,
  HookRegistry,
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
): HookEvent | null {
  const workflowId = currentWorkflowId ?? "unknown";

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
        workflowId,
        reason: mapSuspendReason(event.reason),
      };
    }

    case "pipeline:resume": {
      return {
        type: "workflow:resume",
        workflowId,
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
        workflowId,
        error: event.error,
        stage: event.lastStage,
        recoverable: false,
      };
    }

    case "stage:enter": {
      return {
        type: "workflow:stage:enter",
        workflowId,
        stage: event.stage,
      };
    }

    case "stage:exit": {
      return {
        type: "workflow:stage:exit",
        workflowId,
        stage: event.stage,
        durationMs: event.durationMs,
      };
    }

    case "stage:error": {
      return {
        type: "workflow:stage:error",
        workflowId,
        stage: event.stage,
        error: event.error,
      };
    }

    case "stage:progress": {
      return {
        type: "workflow:stage:progress",
        workflowId,
        stage: event.stage,
        message: event.message,
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

    case "review:check": {
      return {
        type: "workflow:review:check",
        workflowId,
        check: event.check,
      };
    }

    case "review:fix-start": {
      return {
        type: "workflow:review:fix:start",
        workflowId,
        attempt: event.attempt,
        maxAttempts: event.maxAttempts,
      };
    }

    case "review:fix-complete": {
      return {
        type: "workflow:review:fix:complete",
        workflowId,
        attempt: event.attempt,
        success: event.success,
      };
    }

    case "learn:insight": {
      return {
        type: "workflow:learn:insight",
        workflowId,
        insight: event.insight,
      };
    }

    case "wave:aborted": {
      return {
        type: "workflow:wave:aborted",
        workflowId,
        waveId: event.waveId,
        waveFailRate: event.waveFailRate,
        overallFailRate: event.overallFailRate,
      };
    }

    case "context:set": {
      return {
        type: "workflow:context:set",
        workflowId,
        key: event.key,
        value: event.value,
      };
    }

    case "context:cache-hit": {
      return {
        type: "workflow:context:cache-hit",
        workflowId,
        cacheKey: event.cacheKey,
      };
    }

    case "budget:warning": {
      return {
        type: "workflow:budget:warning",
        workflowId,
        costUsd: event.costUsd,
        budgetUsd: event.budgetUsd,
        percentUsed: event.percentUsed,
      };
    }

    case "budget:exceeded": {
      return {
        type: "workflow:budget:exceeded",
        workflowId,
        costUsd: event.costUsd,
        budgetUsd: event.budgetUsd,
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
