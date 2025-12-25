import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { LanguageModel } from "ai";
import type { AiAdapter } from "../../adapters/ai";
import type { ExecutionContext } from "../../context";
import { executePlanPhase } from "../../phases/plan";
import type { RuntimeInput } from "../../types";
import type { Phase, PhaseResult } from "../types";

export class PlanPhase implements Phase<RuntimeInput, void> {
  readonly id = "plan";

  constructor(
    private readonly runId: string,
    private readonly model: LanguageModel,
    private readonly createAiAdapter?: (runId: string) => AiAdapter
  ) {}

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
      const cachedContext = context.get("scanContext") as
        | ExecutionContext
        | null
        | undefined;

      const generator = executePlanPhase(
        input,
        this.runId,
        signal,
        this.model,
        cachedContext ?? undefined,
        this.createAiAdapter
          ? { createAiAdapter: this.createAiAdapter }
          : undefined
      );

      let planSummary: string | null | undefined;
      const iter = generator[Symbol.asyncIterator]();
      while (true) {
        const next = await iter.next();
        if (next.done) {
          planSummary = next.value ?? null;
          break;
        }
        yield next.value;
      }

      if (planSummary) {
        context.set("planSummary", planSummary);
      }

      return { status: "success", data: undefined };
    } catch (error) {
      return { status: "failure", error: error as Error };
    }
  }
}
