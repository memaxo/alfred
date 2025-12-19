/**
 * Workflow Runtime Core
 *
 * Pure execution engine with AsyncGenerator interface.
 * Orchestrates workflow phases, handles cancellation/resume, integrates domain packages.
 */

import { randomUUID } from "node:crypto";
import { BrainstemSupervisor } from "@alfred/agent/orchestrator/loops/supervisor";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import { RuntimeContext } from "@alfred/type/runtime-context";
import type { LanguageModel } from "ai";
import { runCognitiveLoop } from "./loops/cognitive";
import { timestamp } from "@alfred/cognitive/state";
import type { Event } from "@alfred/cognitive/state";
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
const DEFAULT_SUPERVISOR_HEARTBEAT_MS = 60_000; // 60 seconds
const DEFAULT_SUPERVISOR_CHECK_INTERVAL_MS = 1000; // 1 second

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
  private readonly model: LanguageModel;
  // private readonly stepTimeoutMs: number; // Reserved
  private readonly workflowTimeoutMs: number;
  private readonly workflowStartTime: number;
  private readonly authz?: string;

  private readonly state: RuntimeState;
  private readonly signal?: AbortSignal;
  private readonly abortController: AbortController;
  private readonly supervisor: BrainstemSupervisor;
  private physiologyInterval?: ReturnType<typeof setInterval>;
  private readonly supervisorHeartbeatMs: number;
  private readonly supervisorCheckIntervalMs: number;
  private supervisorInterruptReason: string | null = null;
  private supervisorActive = false;

  constructor(options: RuntimeOptions) {
    // Validate options to catch configuration errors early
    const validated = validateRuntimeOptions(options);

    this.runId = validated.runId ?? randomUUID();
    this.summary = `Workflow initialized for ${validated.input.requirement}`;

    // Store for Phase 3.3+ when integrating context builder and AI SDK
    this._input = validated.input;
    this.authz = validated.authz;
    this.model = validated.model;

    this.signal = validated.signal;
    this.abortController = new AbortController();
    this.supervisor = new BrainstemSupervisor();
    // this.stepTimeoutMs = validated.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
    this.workflowTimeoutMs =
      validated.workflowTimeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
    this.workflowStartTime = Date.now();
    this.supervisorHeartbeatMs =
      validated.supervisorHeartbeatMs ?? DEFAULT_SUPERVISOR_HEARTBEAT_MS;
    this.supervisorCheckIntervalMs =
      validated.supervisorCheckIntervalMs ??
      DEFAULT_SUPERVISOR_CHECK_INTERVAL_MS;

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
      this.runtimeContext = providedContext as RuntimeContext<
        Record<string, unknown>
      >;
    } else {
      this.runtimeContext = new RuntimeContext<Record<string, unknown>>([
        ["ai", null],
        ["scanContext", null],
        ["planSummary", null],
        ["eventLog", []],
      ]);
    }

    if (!this.runtimeContext.has("ai")) {
      this.runtimeContext.set("ai", null);
    }
    if (!this.runtimeContext.has("scanContext")) {
      this.runtimeContext.set("scanContext", null);
    }
    if (!this.runtimeContext.has("planSummary")) {
      this.runtimeContext.set("planSummary", null);
    }
    if (!this.runtimeContext.has("eventLog")) {
      this.runtimeContext.set("eventLog", [] as WorkflowEvent[]);
    }

    this.runtimeContext.set("signal", this.abortController.signal);

    if (this.authz) {
      this.runtimeContext.set("authz", this.authz);
    }

    this.runtimeContext.set("aiModel", this.model);
    this.runtimeContext.set("runStartedAt", this.workflowStartTime);

    // Setup cancellation listener
    if (this.signal) {
      if (this.signal.aborted) {
        this.handleExternalAbort(this.signal.reason);
      } else {
        this.signal.addEventListener("abort", () => {
          this.handleExternalAbort(this.signal?.reason);
        });
      }
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

    const eventLog =
      (this.runtimeContext.get("eventLog") as WorkflowEvent[] | undefined) ??
      [];
    if (!this.runtimeContext.has("eventLog")) {
      this.runtimeContext.set("eventLog", eventLog);
    }

    const recordEvent = (event: WorkflowEvent) => {
      try {
        eventLog.push(event);
      } catch {
        // Swallow logging issues to avoid breaking streaming
      }
    };

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

    this.startSupervisorWatchers();

    try {
      // Emit run start event
      const runEvent = { type: "run", id: this.runId } as WorkflowEvent;
      recordEvent(runEvent);
      yield runEvent;
      this.pulseSupervisor(runEvent);
      const initEvent = {
        type: "progress",
        pct: 0,
        message: "initializing",
      } as WorkflowEvent;
      recordEvent(initEvent);
      yield initEvent;
      this.pulseSupervisor(initEvent);

      // Check for cancellation
      if (this.state.cancelled) {
        const cancelledStartEvent = {
          type: "notice",
          message: "workflow_cancelled_before_start",
        } as WorkflowEvent;
        recordEvent(cancelledStartEvent);
        yield cancelledStartEvent;
        this.pulseSupervisor(cancelledStartEvent);
        recordEvent({
          type: "notice",
          message: "workflow_cancelled_before_start",
        } as WorkflowEvent);
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
        .register(new PlanPhase(this.runId, this.model))
        .register(new ActPhase(this.runId, this.model))
        .register(new ReportPhase());

      const checkCancelled = function* (this: WorkflowRuntime) {
        if (this.state.cancelled) {
          const cancelledEvent = {
            type: "notice",
            message: "workflow_cancelled_during_execution",
          } as WorkflowEvent;
          recordEvent(cancelledEvent);
          yield cancelledEvent;
          this.pulseSupervisor(cancelledEvent);
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
        recordEvent(next.value as WorkflowEvent);
        yield next.value;
        this.pulseSupervisor(next.value as WorkflowEvent);

        if (this.state.cancelled) {
          await pipelineIterator.return?.();
          const cancelledEvent = {
            type: "notice",
            message: "workflow_cancelled_during_execution",
          } as WorkflowEvent;
          recordEvent(cancelledEvent);
          yield cancelledEvent;
          this.pulseSupervisor(cancelledEvent);
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
      const completionEvent = {
        type: "progress",
        pct: 100,
        message: "completed",
      } as WorkflowEvent;
      recordEvent(completionEvent);
      yield completionEvent;
      this.pulseSupervisor(completionEvent);

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
      const supervisorReason = this.supervisorInterruptReason;
      const isAlreadySupervisorError =
        (error instanceof Error &&
          error.message.startsWith("workflow_interrupted:")) ||
        (typeof error === "string" &&
          error.startsWith("workflow_interrupted:"));
      const reportedError =
        supervisorReason && !isAlreadySupervisorError
          ? new Error(`workflow_interrupted:${supervisorReason}`)
          : error;

      this.state.finalStatus = "failed";
      this.state.finalMessage =
        reportedError instanceof Error
          ? reportedError.message
          : String(reportedError);

      const errorEvent = {
        type: "error",
        message: this.state.finalMessage,
      } as WorkflowEvent;
      recordEvent(errorEvent);
      yield errorEvent;
      this.pulseSupervisor(errorEvent);

      runtimeExecutionsTotal.inc({
        auto: this._input.auto ?? "low",
        status: "failed",
      });
      stopWorkflow({ status: "failed" });

      logger.error("runtime_execution_failed", {
        runId: this.runId,
        error: this.state.finalMessage,
        durationMs: Date.now() - this.workflowStartTime,
        supervisorReason,
        cause:
          reportedError !== error && error instanceof Error
            ? error.message
            : undefined,
      });

      throw reportedError;
    } finally {
      this.stopSupervisorWatchers();
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
    this.handleExternalAbort("workflow_cancelled");
  }

  /**
   * Get runtime input (for debugging/logging)
   * Reserved for Phase 3.3+ when integrating context builder
   */
  getInput(): RuntimeInput {
    return this._input;
  }

  private handleExternalAbort(reason?: unknown): void {
    this.state.cancelled = true;
    this.abortRuntime(
      reason ?? new DOMException("workflow_cancelled", "AbortError")
    );
  }

  private abortRuntime(reason?: unknown): void {
    if (!this.abortController.signal.aborted) {
      this.abortController.abort(reason);
    }
  }

  private startSupervisorWatchers(): void {
    this.supervisorActive = true;
    this.supervisor.registerProcess(
      this.runId,
      this.abortController,
      this.supervisorHeartbeatMs
    );
    this.physiologyInterval = setInterval(() => {
      const result = this.supervisor.checkPhysiology();
      if (result.interrupt) {
        logger.error("supervisor_physiology_interrupt", {
          runId: this.runId,
          reason: result.reason,
        });

        // Bridge to cognitive loop (fire-and-forget)
        void (async () => {
          try {
            const interruptEvent: Event = {
              _: "interrupt",
              reason: result.reason,
              priority: 2,
              ts: timestamp(Date.now()),
            };
            await runCognitiveLoop(this.runtimeContext, this.runId, interruptEvent);
          } catch (error) {
            logger.error("supervisor_physiology_cognitive_bridge_failed", {
              runId: this.runId,
              reason: result.reason,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();

        this.failFromSupervisor(result.reason);
      }
    }, this.supervisorCheckIntervalMs);
    this.physiologyInterval.unref?.();
  }

  private stopSupervisorWatchers(): void {
    this.supervisorActive = false;
    if (this.physiologyInterval) {
      clearInterval(this.physiologyInterval);
      this.physiologyInterval = undefined;
    }
    this.supervisor.clearProcess();
  }

  private pulseSupervisor(event: WorkflowEvent): void {
    if (!this.supervisorActive) {
      return;
    }
    this.handleSupervisorObservation(event);
    this.supervisor.heartbeat();
  }

  private handleSupervisorObservation(event: WorkflowEvent): void {
    if (!this.supervisorActive) {
      return;
    }
    if (!this.isReasoningEvent(event)) {
      return;
    }
    const content = this.extractReasoningText(event);
    if (!content) {
      return;
    }
    const result = this.supervisor.observe({
      type: "thought",
      content,
    });
    if (result.interrupt) {
      logger.warn("supervisor_interrupt", {
        runId: this.runId,
        reason: result.reason,
      });

      // Bridge to cognitive loop (fire-and-forget)
      void (async () => {
        try {
          const interruptEvent: Event = {
            _: "interrupt",
            reason: result.reason,
            priority: 2, // Medium priority for supervisor interrupts
            ts: timestamp(Date.now()),
          };
          await runCognitiveLoop(this.runtimeContext, this.runId, interruptEvent);
        } catch (error) {
          // Log but don't block workflow interruption
          logger.error("supervisor_cognitive_bridge_failed", {
            runId: this.runId,
            reason: result.reason,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();

      this.failFromSupervisor(result.reason);
      throw new Error(`workflow_interrupted:${result.reason}`);
    }
  }

  private isReasoningEvent(event: WorkflowEvent): boolean {
    return event.type === "reasoning" || event.type === "reasoning-delta";
  }

  private extractReasoningText(event: WorkflowEvent): string | null {
    if (!this.isReasoningEvent(event)) {
      return null;
    }
    const payload = event as {
      text?: unknown;
      reasoning?: unknown;
      content?: unknown;
      textDelta?: unknown;
      delta?: unknown;
    };
    const candidate = [
      payload.text,
      payload.reasoning,
      payload.content,
      payload.textDelta,
      payload.delta,
    ].find((value) => typeof value === "string" && value.length > 0) as
      | string
      | undefined;
    const trimmed = candidate?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }

  private failFromSupervisor(reason: string): void {
    if (!this.supervisorInterruptReason) {
      this.supervisorInterruptReason = reason;
    }
    this.abortRuntime(reason);
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
