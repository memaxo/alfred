import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import { executeActPhase } from "../../phases/act";
import type { RuntimeInput } from "../../types";
import type { Phase, PhaseResult } from "../types";

export class ActPhase implements Phase<RuntimeInput, void> {
  readonly id = "act";

  constructor(private readonly runId: string) {}

  async *run(
    input: RuntimeInput,
    _context: RuntimeContext
  ): AsyncGenerator<WorkflowEvent, PhaseResult<void>, void> {
    try {
      const controller = new AbortController();
      // history is missing here.
      // executeActPhase(input, runId, signal, history)
      // We need to pass history via context or input?
      // The input type RuntimeInput doesn't have history.
      // But WorkflowRuntime has it.

      const generator = executeActPhase(input, this.runId, controller.signal);

      for await (const event of generator) {
        yield event;
      }

      return { status: "success", data: undefined };
    } catch (error) {
      return { status: "failure", error: error as Error };
    }
  }
}
