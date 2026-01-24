import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";

import { logger } from "@alfred/logger";

import type { Phase, PhaseResult, PipelineState } from "./types";

import { runtimePhaseDurationSeconds, runtimePhasesTotal } from "../metrics";

const DEFAULT_PHASE_TIMEOUTS: Record<string, number> = {
  scan: 60_000,
  plan: 120_000,
  act: 300_000,
  report: 60_000,
};

const DEFAULT_PHASE_TIMEOUT_MS = 120_000;

type PipelineRunnerOptions = {
  phaseTimeouts?: Record<string, number>;
  defaultPhaseTimeoutMs?: number;
};

function readId(
  ctx: RuntimeContext,
  key: "runId" | "workflowId" | "userId"
): string | undefined {
  const v = ctx.get(key);
  return typeof v === "string" ? v : undefined;
}

function readIds(ctx: RuntimeContext): {
  runId?: string;
  workflowId?: string;
  userId?: string;
} {
  return {
    runId: readId(ctx, "runId"),
    workflowId: readId(ctx, "workflowId"),
    userId: readId(ctx, "userId"),
  };
}

export class PhaseTimeoutError extends Error {
  constructor(
    public readonly phaseId: string,
    public readonly timeoutMs: number
  ) {
    super(`phase_timeout:${phaseId}`);
    this.name = "PhaseTimeoutError";
  }
}

export class PhaseRunner {
  private readonly state: PipelineState;
  private readonly phases: Map<string, Phase<any, any>> = new Map();
  private readonly phaseOrder: string[] = [];
  private readonly MAX_TRANSITIONS = 50; // Safety limit for escalation loops
  private readonly phaseTimeouts: Record<string, number>;
  private readonly defaultPhaseTimeoutMs: number;

  constructor(
    initialState: PipelineState,
    options: PipelineRunnerOptions = {}
  ) {
    this.state = initialState;
    this.phaseTimeouts = {
      ...DEFAULT_PHASE_TIMEOUTS,
      ...(options.phaseTimeouts ?? {}),
    };
    this.defaultPhaseTimeoutMs =
      options.defaultPhaseTimeoutMs ?? DEFAULT_PHASE_TIMEOUT_MS;
  }

  register<I, O>(phase: Phase<I, O>): this {
    if (this.phases.has(phase.id)) {
      // Replace existing registration while preserving order semantics
      const existingIndex = this.phaseOrder.indexOf(phase.id);
      if (existingIndex >= 0) {
        this.phaseOrder.splice(existingIndex, 1);
      }
    }
    this.phases.set(phase.id, phase);
    this.phaseOrder.push(phase.id);
    return this;
  }

  private nextPhaseId(currentPhaseId: string): string | null {
    const idx = this.phaseOrder.indexOf(currentPhaseId);
    if (idx === -1) {
      return null;
    }
    return this.phaseOrder[idx + 1] ?? null;
  }

  /**
   * Run the pipeline starting from the current phase
   */
  async *run<I>(initialInput: I): AsyncGenerator<WorkflowEvent, void, void> {
    let currentInput: unknown = initialInput;
    let phaseId = this.state.currentPhaseId;
    let transitionCount = 0;
    const ids = readIds(this.state.context);

    while (true) {
      if (transitionCount++ > this.MAX_TRANSITIONS) {
        throw new Error(
          `Pipeline exceeded maximum transitions (${this.MAX_TRANSITIONS}). Possible escalation loop detected.`
        );
      }

      const phase = this.phases.get(phaseId);
      if (!phase) {
        throw new Error(`Phase not found: ${phaseId}`);
      }

      this.state.currentPhaseId = phaseId;

      logger.info("pipeline_phase_start", { ...ids, phaseId });
      yield { _: "step-start", phase: phaseId } as any;
      const timeoutMs = this.resolvePhaseTimeout(phaseId);
      const timeoutGuard = this.createPhaseTimeoutGuard(phaseId, timeoutMs);
      const generator = phase.run(currentInput, this.state.context);
      const iter = generator[Symbol.asyncIterator]();
      let result: PhaseResult<any> | undefined;
      const stopPhaseTimer = runtimePhaseDurationSeconds.startTimer({
        phase: phaseId,
      });

      try {
        // Manually iterate to capture return value
        while (true) {
          const next = await Promise.race([iter.next(), timeoutGuard.promise]);
          if (next.done) {
            result = next.value;
            break;
          }
          yield next.value;
        }
        if (!result) {
          throw new Error(`Phase ${phaseId} produced no result`);
        }

        this.state.history.push({
          phaseId,
          result: result.status,
          timestamp: Date.now(),
        });

        if (result.status === "success") {
          logger.info("pipeline_phase_success", { ...ids, phaseId });
          runtimePhasesTotal.inc({ phase: phaseId, status: "success" });
          yield { _: "step-complete", phase: phaseId } as any;
          // Treat undefined phase outputs as "no change" to the carried input.
          // Many phases are side-effecting and return `void` while still expecting
          // subsequent phases to receive the original RuntimeInput.
          currentInput = result.data === undefined ? currentInput : result.data;
          const nextId = this.nextPhaseId(phaseId);
          if (!nextId) {
            return;
          }
          phaseId = nextId;
          continue;
        }
        if (result.status === "failure") {
          logger.error("pipeline_phase_failure", {
            ...ids,
            phaseId,
            error: result.error.message,
          });
          runtimePhasesTotal.inc({ phase: phaseId, status: "failure" });
          throw result.error;
        }
        if (result.status === "escalate") {
          logger.warn("pipeline_phase_escalation", {
            ...ids,
            phaseId,
            reason: result.reason,
            target: result.targetPhase,
          });
          runtimePhasesTotal.inc({ phase: phaseId, status: "escalate" });

          if (result.targetPhase) {
            phaseId = result.targetPhase;
            this.state.currentPhaseId = phaseId;
          } else {
            throw new Error(
              `Escalation without target from ${phaseId}: ${result.reason}`
            );
          }
        }
      } catch (error) {
        await iter
          .return?.({
            status: "failure",
            error: error instanceof Error ? error : new Error(String(error)),
          })
          .catch(() => {});
        this.state.history.push({
          phaseId,
          result: "failure",
          timestamp: Date.now(),
        });
        logger.error("pipeline_execution_error", {
          ...ids,
          phaseId,
          error: error instanceof Error ? error.message : String(error),
          timeoutMs:
            error instanceof PhaseTimeoutError ? error.timeoutMs : undefined,
        });
        runtimePhasesTotal.inc({ phase: phaseId, status: "failure" });
        throw error;
      } finally {
        timeoutGuard.cancel();
        stopPhaseTimer();
      }
    }
  }

  private resolvePhaseTimeout(phaseId: string): number {
    return this.phaseTimeouts[phaseId] ?? this.defaultPhaseTimeoutMs;
  }

  private createPhaseTimeoutGuard(
    phaseId: string,
    timeoutMs: number
  ): {
    promise: Promise<never>;
    cancel: () => void;
  } {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const timeoutError = new PhaseTimeoutError(phaseId, timeoutMs);

    const promise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(timeoutError), timeoutMs);
    });

    const cancel = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    return { promise, cancel };
  }
}
