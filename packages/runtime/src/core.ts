/**
 * Workflow Runtime Core
 * 
 * Pure execution engine with AsyncGenerator interface.
 * Orchestrates workflow phases, handles cancellation/resume, integrates domain packages.
 */

import { randomUUID } from "node:crypto";

import type { WorkflowEvent } from "@alfred/type/plan";
import type { LanguageModel } from "ai";
import { logger } from "@alfred/api/utils/logger";
import {
  runtimeExecutionsTotal,
  runtimeExecutionDurationSeconds,
  runtimePhasesTotal,
  runtimePhaseDurationSeconds,
} from "./metrics";
import {
  validateRuntimeOptions,
  type RuntimeInput,
  type RuntimeOptions,
  type RuntimeState,
  type ResumePayload,
  type WorkflowPhase,
  type WorkflowRuntime as IWorkflowRuntime,
} from "./types";

const DEFAULT_STEP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_WORKFLOW_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const RESUME_TIMEOUT_MS = 10_000; // 10 seconds

/**
 * WorkflowRuntime implements the core execution engine.
 * 
 * Maintains backward compatibility with RunPlanV6 interface while providing
 * clean separation of concerns and testability via dependency injection.
 */
export class WorkflowRuntime implements IWorkflowRuntime {
  public readonly runId: string;
  public readonly summary: string;
  
  // Lazy generator initialization to prevent eager execution
  private _stream: AsyncGenerator<WorkflowEvent, void, void> | null = null;
  public get stream(): AsyncGenerator<WorkflowEvent, void, void> {
    if (!this._stream) {
      this._stream = this.execute();
    }
    return this._stream;
  }

  // Reserved for Phase 3.3+ integration (intentionally unused for now)
  private readonly _input: RuntimeInput;
  private readonly _model: LanguageModel;
  private readonly stepTimeoutMs: number;
  private readonly workflowTimeoutMs: number;
  private readonly workflowStartTime: number;
  
  private state: RuntimeState;
  private signal?: AbortSignal;

  constructor(options: RuntimeOptions) {
    // Validate options to catch configuration errors early
    const validated = validateRuntimeOptions(options);
    
    this.runId = randomUUID();
    this.summary = `Workflow initialized for ${validated.input.requirement}`;
    
    // Store for Phase 3.3+ when integrating context builder and AI SDK
    this._input = validated.input;
    this._model = validated.model;
    
    this.signal = validated.signal;
    this.stepTimeoutMs = validated.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
    this.workflowTimeoutMs = validated.workflowTimeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
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
    });
    
    try {
      // Emit run start event
      yield { type: "run", id: this.runId } as WorkflowEvent;
      yield { type: "progress", pct: 0, message: "initializing" } as WorkflowEvent;

      // Check for cancellation
      if (this.state.cancelled) {
        yield { type: "notice", message: "workflow_cancelled_before_start" } as WorkflowEvent;
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

      // Execute phases sequentially
      const phases: WorkflowPhase[] = ["scan", "plan", "act", "report"];
      
      for (const phase of phases) {
        if (this.state.cancelled) {
          this.state.finalStatus = "cancelled";
          yield { type: "notice", message: `workflow_cancelled_during_${phase}` } as WorkflowEvent;
          
          runtimeExecutionsTotal.inc({ 
            auto: this._input.auto ?? "low",
            status: "cancelled",
          });
          stopWorkflow({ status: "cancelled" });
          
          logger.info("runtime_execution_cancelled", {
            runId: this.runId,
            phase,
          });
          
          return;
        }

        checkTimeout();
        this.state.phase = phase;
        
        yield* this.executePhase(phase);
      }

      // Workflow completed successfully
      this.state.finalStatus = "completed";
      yield { type: "progress", pct: 100, message: "completed" } as WorkflowEvent;
      
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
      this.state.finalMessage = error instanceof Error ? error.message : String(error);
      
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
   * Execute a single workflow phase with timeout
   * 
   * Uses AbortController to enforce timeout during phase execution,
   * not just after completion.
   */
  private async *executePhase(phase: WorkflowPhase): AsyncGenerator<WorkflowEvent, void, void> {
    const startTime = Date.now();
    const stopPhase = runtimePhaseDurationSeconds.startTimer({ phase });
    const phaseAbort = new AbortController();
    
    runtimePhasesTotal.inc({ phase, status: "started" });
    
    logger.info("runtime_phase_start", {
      runId: this.runId,
      phase,
      requirement: this._input.requirement.slice(0, 100),
    });
    
    // Set timeout to abort phase if it runs too long
    const timeout = setTimeout(() => {
      phaseAbort.abort();
    }, this.stepTimeoutMs);
    
    try {
      yield { type: "step-start", phase } as any;
      yield { type: "progress", pct: this.getProgressForPhase(phase), message: `${phase}_started` } as WorkflowEvent;

      // Phase-specific execution with abort signal
      switch (phase) {
        case "scan":
          yield* this.executeScanPhase(phaseAbort.signal);
          break;
        case "plan":
          yield* this.executePlanPhase(phaseAbort.signal);
          break;
        case "act":
          yield* this.executeActPhase(phaseAbort.signal);
          break;
        case "report":
          yield* this.executeReportPhase(phaseAbort.signal);
          break;
      }

      yield { type: "step-complete", phase } as any;
      yield { type: "progress", pct: this.getProgressForPhase(phase, true), message: `${phase}_completed` } as WorkflowEvent;
      
      const durationMs = Date.now() - startTime;
      runtimePhasesTotal.inc({ phase, status: "completed" });
      stopPhase();
      
      logger.info("runtime_phase_complete", {
        runId: this.runId,
        phase,
        durationMs,
        status: "success",
      });

    } catch (error) {
      const durationMs = Date.now() - startTime;
      runtimePhasesTotal.inc({ phase, status: "failed" });
      stopPhase();
      
      // Check if error is due to phase timeout
      if (error instanceof DOMException && error.name === "AbortError") {
        logger.error("runtime_phase_timeout", {
          runId: this.runId,
          phase,
          durationMs,
          timeoutMs: this.stepTimeoutMs,
        });
        yield { type: "error", message: "phase_timeout" } as WorkflowEvent;
      } else {
        logger.error("runtime_phase_failed", {
          runId: this.runId,
          phase,
          error: error instanceof Error ? error.message : String(error),
          durationMs,
        });
        yield {
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        } as WorkflowEvent;
      }
      throw error;
    } finally {
      // Always clear timeout to prevent leaks
      clearTimeout(timeout);
    }
  }

  /**
   * Scan phase: context gathering
   * 
   * @param signal AbortSignal to cancel phase if timeout exceeded
   */
  private async *executeScanPhase(signal: AbortSignal): AsyncGenerator<WorkflowEvent, void, void> {
    yield { type: "context", phase: "scan", message: "gathering_context" } as WorkflowEvent;
    
    // Check for abort
    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }
    
    // TODO: Integrate with context builder (Phase 3.2)
    // For now, emit placeholder
    yield { type: "notice", message: "context_gathering_placeholder" } as WorkflowEvent;
  }

  /**
   * Plan phase: AI planning with tool calls
   * 
   * @param signal AbortSignal to cancel phase if timeout exceeded
   */
  private async *executePlanPhase(signal: AbortSignal): AsyncGenerator<WorkflowEvent, void, void> {
    yield { type: "notice", message: "planning_started" } as WorkflowEvent;
    
    // Check for abort
    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }
    
    // TODO: Integrate with AI SDK adapter (Phase 3.2)
    // Pass signal to streamText via AISDKAdapter
    yield { type: "notice", message: "planning_placeholder" } as WorkflowEvent;
  }

  /**
   * Act phase: execute plan with tools
   * 
   * @param signal AbortSignal to cancel phase if timeout exceeded
   */
  private async *executeActPhase(signal: AbortSignal): AsyncGenerator<WorkflowEvent, void, void> {
    yield { type: "notice", message: "execution_started" } as WorkflowEvent;
    
    // Check for abort
    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }
    
    // TODO: Integrate with AI SDK adapter for tool execution (Phase 3.2)
    // Pass signal to tools for cancellation
    yield { type: "notice", message: "execution_placeholder" } as WorkflowEvent;
  }

  /**
   * Report phase: generate summary
   * 
   * @param signal AbortSignal to cancel phase if timeout exceeded
   */
  private async *executeReportPhase(signal: AbortSignal): AsyncGenerator<WorkflowEvent, void, void> {
    yield { type: "notice", message: "reporting_started" } as WorkflowEvent;
    
    // Check for abort
    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }
    
    // TODO: Generate report (Phase 3.2)
    // For now, emit placeholder
    yield { type: "notice", message: "reporting_placeholder" } as WorkflowEvent;
  }

  /**
   * Calculate progress percentage for phase
   */
  private getProgressForPhase(phase: WorkflowPhase, completed = false): number {
    const phaseProgress: Record<WorkflowPhase, { start: number; end: number }> = {
      scan: { start: 10, end: 25 },
      plan: { start: 25, end: 50 },
      act: { start: 50, end: 90 },
      report: { start: 90, end: 100 },
    };
    
    const range = phaseProgress[phase];
    return completed ? range.end : range.start;
  }

  /**
   * Wait for resume payload with timeout
   * 
   * Used during workflow execution when elevated authorization is required.
   * Will be integrated in Phase 3.4+ when adding policy-based authorization.
   * 
   * Timer is stored for cleanup on early resume to prevent resource leaks.
   * 
   * @private Reserved for future use - currently unused
   */
  // @ts-expect-error - Reserved for Phase 3.4+, currently unused
  private async waitForResume(
    requiredEvent: ResumePayload["event"]
  ): Promise<ResumePayload | null> {
    // Check queue first
    const queued = this.state.resumeQueue.find((p) => p.event === requiredEvent);
    if (queued) {
      this.state.resumeQueue = this.state.resumeQueue.filter((p) => p !== queued);
      return queued;
    }

    // Wait for new resume with clearable timeout
    return new Promise<ResumePayload | null>((resolve) => {
      this.state.resumeResolver = resolve;

      // Store timeout handle for cleanup
      const timeout = setTimeout(() => {
        if (this.state.resumeResolver === resolve) {
          this.state.resumeResolver = null;
          this.state.resumeTimeout = null;
          resolve(null); // Timeout, continue without authz
        }
      }, RESUME_TIMEOUT_MS);
      
      this.state.resumeTimeout = timeout;
    });
  }

  /**
   * Resume workflow with authorization
   * 
   * Public API matching RunPlanV6 interface.
   * Clears timeout if resume arrives before timeout fires.
   */
  public async resume(payload: ResumePayload): Promise<void> {
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
  public cancel(): void {
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
  getModel(): LanguageModel {
    return this._model;
  }
}

/**
 * Create a new workflow runtime instance
 * 
 * Factory function for creating runtime with options
 */
export function createRuntime(options: RuntimeOptions): IWorkflowRuntime {
  return new WorkflowRuntime(options);
}

