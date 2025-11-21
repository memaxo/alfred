import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import { executeScanPhase } from "../../phases/scan";
import type { RuntimeInput } from "../../types";
import type { Phase, PhaseResult } from "../types";

export class ScanPhase implements Phase<RuntimeInput, void> {
  readonly id = "scan";

  constructor(private readonly runId: string) {}

  async *run(
    input: RuntimeInput,
    _context: RuntimeContext
  ): AsyncGenerator<WorkflowEvent, PhaseResult<void>, void> {
    try {
      const controller = new AbortController();
      const generator = executeScanPhase(input, this.runId, controller.signal);

      for await (const event of generator) {
        yield event;
      }

      return { status: "success", data: undefined };
    } catch (error) {
      return { status: "failure", error: error as Error };
    }
  }
}
