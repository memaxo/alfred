import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { Phase, PhaseResult, PipelineState } from "./types";

export class PipelineRunner {
  private readonly state: PipelineState;
  private readonly phases: Map<string, Phase<any, any>> = new Map();
  private readonly phaseOrder: string[] = [];
  private readonly MAX_TRANSITIONS = 50; // Safety limit for escalation loops

  constructor(initialState: PipelineState) {
    this.state = initialState;
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
    const currentInput = initialInput;
    let phaseId = this.state.currentPhaseId;
    let transitionCount = 0;

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

      logger.info("pipeline_phase_start", { phaseId });
      yield { type: "step-start", phase: phaseId } as any;

      try {
        const generator = phase.run(currentInput, this.state.context);
        let result: PhaseResult<any>;

        // Manually iterate to capture return value
        const iter = generator[Symbol.asyncIterator]();
        while (true) {
          const next = await iter.next();
          if (next.done) {
            result = next.value;
            break;
          }
          yield next.value;
        }

        this.state.history.push({
          phaseId,
          result: result.status,
          timestamp: Date.now(),
        });

        if (result.status === "success") {
          logger.info("pipeline_phase_success", { phaseId });
          yield { type: "step-complete", phase: phaseId } as any;
          const nextId = this.nextPhaseId(phaseId);
          if (!nextId) {
            return;
          }
          phaseId = nextId;
          continue;
        }
        if (result.status === "failure") {
          logger.error("pipeline_phase_failure", {
            phaseId,
            error: result.error.message,
          });
          throw result.error;
        }
        if (result.status === "escalate") {
          logger.warn("pipeline_phase_escalation", {
            phaseId,
            reason: result.reason,
            target: result.targetPhase,
          });

          if (result.targetPhase) {
            phaseId = result.targetPhase;
            // TODO: Input transformation?
            this.state.currentPhaseId = phaseId;
          } else {
            throw new Error(
              `Escalation without target from ${phaseId}: ${result.reason}`
            );
          }
        }
      } catch (error) {
        logger.error("pipeline_execution_error", {
          phaseId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }
}
