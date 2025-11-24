import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import { executePlanPhase } from "../../phases/plan";
import type { ExecutionContext } from "../../context";
import type { RuntimeInput } from "../../types";
import type { Phase, PhaseResult } from "../types";

export class PlanPhase implements Phase<RuntimeInput, void> {
  readonly id = "plan";

  constructor(private readonly runId: string) {}

  async *run(
    input: RuntimeInput,
    context: RuntimeContext
  ): AsyncGenerator<WorkflowEvent, PhaseResult<void>, void> {
    try {
      // Wrap existing executePlanPhase
      // Note: executePlanPhase needs an abort signal, which we don't have in RuntimeContext yet?
      // PipelineRunner should probably manage the signal for the phase.
      // For now, we'll pass a dummy or create one.
      // Ideally RuntimeContext has the signal.
      // But RuntimeContext type in @alfred/type/runtime-context is minimal.
      // We are using the one from core.ts 'RuntimeState'? No.

      // Let's just use a new controller for the phase for now
      const controller = new AbortController();
      const cachedContext = context.get("scanContext") as
        | ExecutionContext
        | null
        | undefined;

      const generator = executePlanPhase(
        input,
        this.runId,
        controller.signal,
        cachedContext ?? undefined
      );

      for await (const event of generator) {
        yield event;
      }

      return { status: "success", data: undefined };
    } catch (error) {
      return { status: "failure", error: error as Error };
    }
  }
}
