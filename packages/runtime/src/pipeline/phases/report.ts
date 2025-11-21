import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import { executeReportPhase } from "../../phases/report";
import type { RuntimeInput } from "../../types";
import type { Phase, PhaseResult } from "../types";

export class ReportPhase implements Phase<RuntimeInput, void> {
  readonly id = "report";

  async *run(
    _input: RuntimeInput,
    _context: RuntimeContext
  ): AsyncGenerator<WorkflowEvent, PhaseResult<void>, void> {
    try {
      const controller = new AbortController();
      const generator = executeReportPhase(controller.signal);

      for await (const event of generator) {
        yield event;
      }

      return { status: "success", data: undefined };
    } catch (error) {
      return { status: "failure", error: error as Error };
    }
  }
}
