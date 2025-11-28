import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { ExecutionContext } from "../../context";
import { executeReportPhase } from "../../phases/report";
import type { RuntimeInput } from "../../types";
import type { Phase, PhaseResult } from "../types";

export class ReportPhase implements Phase<RuntimeInput, void> {
  readonly id = "report";

  async *run(
    input: RuntimeInput,
    context: RuntimeContext
  ): AsyncGenerator<WorkflowEvent, PhaseResult<void>, void> {
    try {
      const controller = new AbortController();
      const runtimeSignal = context.get("signal") as
        | AbortSignal
        | null
        | undefined;
      const signal = runtimeSignal ?? controller.signal;
      const events =
        (context.get("eventLog") as WorkflowEvent[] | undefined) ?? [];
      const scanContext = context.get("scanContext") as
        | ExecutionContext
        | null
        | undefined;
      const planSummary = context.get("planSummary") as
        | string
        | null
        | undefined;
      const startedAt = context.get("runStartedAt") as number | undefined;

      const generator = executeReportPhase(input, signal, {
        events,
        scanContext,
        planSummary,
        startedAt,
      });

      for await (const event of generator) {
        yield event;
      }

      return { status: "success", data: undefined };
    } catch (error) {
      return { status: "failure", error: error as Error };
    }
  }
}
