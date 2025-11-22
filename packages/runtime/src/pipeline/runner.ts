import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { Phase, PhaseResult, PipelineState } from "./types";

export class PipelineRunner {
  private readonly state: PipelineState;
  private readonly phases: Map<string, Phase<any, any>> = new Map();
  private readonly MAX_TRANSITIONS = 50; // Safety limit for escalation loops

  constructor(initialState: PipelineState) {
    this.state = initialState;
  }

  register<I, O>(phase: Phase<I, O>): this {
    this.phases.set(phase.id, phase);
    return this;
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
          // Pipeline success (for now, terminate)
          return;
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
