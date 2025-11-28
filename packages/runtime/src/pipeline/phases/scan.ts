import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { ExecutionContext } from "../../context";
import { executeScanPhase } from "../../phases/scan";
import type { RuntimeInput } from "../../types";
import type { Phase, PhaseResult } from "../types";

export class ScanPhase implements Phase<RuntimeInput, void> {
  readonly id = "scan";

  constructor(private readonly runId: string) {}

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
      const authz = context.get("authz") as string | undefined;
      const userId = context.get("userId") as string | undefined;
      const generator = executeScanPhase(
        input,
        this.runId,
        signal,
        authz,
        userId
      );

      let scanContext: ExecutionContext | null | undefined;
      const iter = generator[Symbol.asyncIterator]();
      while (true) {
        const next = await iter.next();
        if (next.done) {
          scanContext = next.value ?? null;
          break;
        }
        yield next.value;
      }

      if (scanContext) {
        context.set("scanContext", scanContext);
      }

      return { status: "success", data: undefined };
    } catch (error) {
      return { status: "failure", error: error as Error };
    }
  }
}
