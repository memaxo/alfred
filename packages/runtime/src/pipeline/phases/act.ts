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
      // Safely access authz from context (casted as any because core.ts passes a POJO)
      const authz = (_context as any).authz;

      const generator = executeActPhase(input, this.runId, controller.signal, undefined, undefined, authz);
      let result: { escalated: boolean; reason?: string } | undefined;

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

      if (result?.escalated) {
        return {
          status: "escalate",
          reason: result.reason ?? "Unknown escalation",
          targetPhase: "plan", // Re-plan on escalation
        };
      }

      return { status: "success", data: undefined };
    } catch (error) {
      return { status: "failure", error: error as Error };
    }
  }
}
