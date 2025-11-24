/**
 * Workflow Runtime Core
 *
 * Pure execution engine with AsyncGenerator interface.
 * Orchestrates workflow phases, handles cancellation/resume, integrates domain packages.
 */

import { randomUUID } from "node:crypto";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { RuntimeContext } from "@alfred/type/runtime-context";
// import type { LanguageModel } from "ai";
import {
  runtimeExecutionDurationSeconds,
  runtimeExecutionsTotal,
} from "./metrics";
import {
  type WorkflowRuntime as IWorkflowRuntime,
  type ResumePayload,
  type RuntimeInput,
  type RuntimeOptions,
  type RuntimeState,
  validateRuntimeOptions,
} from "./types";

// const DEFAULT_STEP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_WORKFLOW_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

import { ActPhase } from "./pipeline/phases/act";
import { PlanPhase } from "./pipeline/phases/plan";
import { ReportPhase } from "./pipeline/phases/report";
import { ScanPhase } from "./pipeline/phases/scan";
import { PipelineRunner } from "./pipeline/runner";
import type { PipelineState } from "./pipeline/types";

export class WorkflowRuntime implements IWorkflowRuntime {
  readonly runId: string;
  readonly summary: string;
  private readonly runtimeContext: RuntimeContext<Record<string, unknown>>;

  // Lazy generator initialization to prevent eager execution
  private _stream: AsyncGenerator<WorkflowEvent, void, void> | null = null;
  get stream(): AsyncGenerator<WorkflowEvent, void, void> {
    if (!this._stream) {
      this._stream = this.execute();
    }
    return this._stream;
  }

  private readonly _input: RuntimeInput;
  // private readonly _model: LanguageModel; // Reserved
  // private readonly stepTimeoutMs: number; // Reserved
  private readonly workflowTimeoutMs: number;
  private readonly workflowStartTime: number;
  private readonly authz?: string;

  private readonly state: RuntimeState;
  private readonly signal?: AbortSignal;

  constructor(options: RuntimeOptions) {
    // Validate options to catch configuration errors early
    const validated = validateRuntimeOptions(options);

    this.runId = validated.runId ?? randomUUID();
    this.summary = `Workflow initialized for ${validated.input.requirement}`;

    // Store for Phase 3.3+ when integrating context builder and AI SDK
    this._input = validated.input;
    this.authz = validated.authz;
    // this._model = validated.model;

    this.signal = validated.signal;
    // this.stepTimeoutMs = validated.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
    this.workflowTimeoutMs =
      validated.workflowTimeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
    this.workflowStartTime = Date.now();

    // Initialize runtime state
    this.state = {
      runId: this.runId,
      phase: null,
      cancelled: false,
      resumeResolver: null,
      resumeQueue: [],
      resumeTimeout: null,
      finalStatus: null,
      finalMessage: null,
    };

    const providedContext = validated.runtimeContext;
    if (providedContext) {
      this.runtimeContext = providedContext as RuntimeContext<Record<string, unknown>>;
    } else {
      this.runtimeContext = new RuntimeContext<Record<string, unknown>>([
        ["ai", null],
        ["scanContext", null],
      ]);
    }

    if (!this.runtimeContext.has("ai")) {
      this.runtimeContext.set("ai", null);
    }

    if (this.signal) {
      this.runtimeContext.set("signal", this.signal);
    } else if (!this.runtimeContext.has("signal")) {
      this.runtimeContext.set("signal", null);
    }

    if (this.authz) {
      this.runtimeContext.set("authz", this.authz);
    }

    // Setup cancellation listener
    if (this.signal) {
      if (this.signal.aborted) {
        this.state.cancelled = true;
      }
      this.signal.addEventListener("abort", () => {
        this.state.cancelled = true;
      });
    }
  }

  /**
   * Main execution generator
   *
   * Yields WorkflowEvent instances as execution proceeds.
   * Implements all phases: scan, plan, act, report.
   */
  private async *execute(): AsyncGenerator<WorkflowEvent, void, void> {
    const stopWorkflow = runtimeExecutionDurationSeconds.startTimer({
      auto: this._input.auto ?? "low",
    });

    runtimeExecutionsTotal.inc({
      auto: this._input.auto ?? "low",
      status: "started",
    });

    logger.info("runtime_execution_start", {
      runId: this.runId,
      requirement: this._input.requirement.slice(0, 100),
      auto: this._input.auto ?? "low",
      interactive: this._input.interactive,
    });

    try {
      // Emit run start event
      yield { type: "run", id: this.runId } as WorkflowEvent;
      yield {
        type: "progress",
        pct: 0,
        message: "initializing",
      } as WorkflowEvent;

      // Check for cancellation
      if (this.state.cancelled) {
        yield {
          type: "notice",
          message: "workflow_cancelled_before_start",
        } as WorkflowEvent;
        this.state.finalStatus = "cancelled";

        runtimeExecutionsTotal.inc({
          auto: this._input.auto ?? "low",
          status: "cancelled",
        });
        stopWorkflow({ status: "cancelled" });

        logger.info("runtime_execution_cancelled", {
          runId: this.runId,
          phase: "initialization",
        });

        return;
      }

      // Check for workflow timeout
      const checkTimeout = () => {
        if (Date.now() - this.workflowStartTime > this.workflowTimeoutMs) {
          throw new Error("workflow_timeout");
        }
      };
      checkTimeout();

      // Initialize Pipeline
      const pipelineState: PipelineState = {
        currentPhaseId: "scan",
        history: [],
        context: this.runtimeContext,
      };

      const runner = new PipelineRunner(pipelineState)
        .register(new ScanPhase(this.runId))
        .register(new PlanPhase(this.runId))
        .register(new ActPhase(this.runId))
        .register(new ReportPhase());

      const checkCancelled = function* (this: WorkflowRuntime) {
        if (this.state.cancelled) {
          yield {
            type: "notice",
            message: "workflow_cancelled_during_execution",
          } as WorkflowEvent;
          this.state.finalStatus = "cancelled";
          runtimeExecutionsTotal.inc({
            auto: this._input.auto ?? "low",
            status: "cancelled",
          });
          stopWorkflow({ status: "cancelled" });
          logger.info("runtime_execution_cancelled", {
            runId: this.runId,
            phase: pipelineState.currentPhaseId,
          });
          return true;
        }
        return false;
      }.bind(this);

      pipelineState.currentPhaseId = "scan";
      if (yield* checkCancelled()) {
        return;
      }

      const pipelineIterator = runner.run(this._input)[Symbol.asyncIterator]();
      while (true) {
        const next = await pipelineIterator.next();
        if (next.done) {
          break;
        }
        yield next.value;

        if (this.state.cancelled) {
          await pipelineIterator.return?.();
          yield {
            type: "notice",
            message: "workflow_cancelled_during_execution",
          } as WorkflowEvent;
          this.state.finalStatus = "cancelled";
          runtimeExecutionsTotal.inc({
            auto: this._input.auto ?? "low",
            status: "cancelled",
          });
          stopWorkflow({ status: "cancelled" });
          logger.info("runtime_execution_cancelled", {
            runId: this.runId,
            phase: pipelineState.currentPhaseId,
          });
          return;
        }
      }

      // Workflow completed successfully
      this.state.finalStatus = "completed";
      yield {
        type: "progress",
        pct: 100,
        message: "completed",
      } as WorkflowEvent;

      runtimeExecutionsTotal.inc({
        auto: this._input.auto ?? "low",
        status: "completed",
      });
      stopWorkflow({ status: "completed" });

      logger.info("runtime_execution_complete", {
        runId: this.runId,
        durationMs: Date.now() - this.workflowStartTime,
      });
    } catch (error) {
      this.state.finalStatus = "failed";
      this.state.finalMessage =
        error instanceof Error ? error.message : String(error);

      yield {
        type: "error",
        message: this.state.finalMessage,
      } as WorkflowEvent;

      runtimeExecutionsTotal.inc({
        auto: this._input.auto ?? "low",
        status: "failed",
      });
      stopWorkflow({ status: "failed" });

      logger.error("runtime_execution_failed", {
        runId: this.runId,
        error: this.state.finalMessage,
        durationMs: Date.now() - this.workflowStartTime,
      });

      throw error;
    }
  }

  /**
   * Resume workflow with authorization
   *
   * Public API matching RunPlanV6 interface.
   * Clears timeout if resume arrives before timeout fires.
   */
  async resume(payload: ResumePayload): Promise<void> {
    const resolver = this.state.resumeResolver;
    if (resolver) {
      // Clear pending timeout to prevent leak
      if (this.state.resumeTimeout) {
        clearTimeout(this.state.resumeTimeout);
        this.state.resumeTimeout = null;
      }

      // Resolve in-flight wait
      this.state.resumeResolver = null;
      resolver(payload);
    } else {
      // Not waiting yet, queue for next wait
      this.state.resumeQueue.push(payload);
    }
  }

  /**
   * Cancel workflow execution
   *
   * Public API matching RunPlanV6 interface
   */
  cancel(): void {
    this.state.cancelled = true;
  }

  /**
   * Get runtime input (for debugging/logging)
   * Reserved for Phase 3.3+ when integrating context builder
   */
  getInput(): RuntimeInput {
    return this._input;
  }

  /**
   * Get runtime model (for debugging/logging)
   * Reserved for Phase 3.3+ when integrating AI SDK
   */
  // getModel(): LanguageModel {
  //   return this._model;
  // }
}

/**
 * Create a new workflow runtime instance
 *
 * Factory function for creating runtime with options
 */
export function createRuntime(options: RuntimeOptions): IWorkflowRuntime {
  return new WorkflowRuntime(options);
}
