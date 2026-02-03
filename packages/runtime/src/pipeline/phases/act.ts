import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { LanguageModel } from "ai";

import type { AiAdapter } from "../../adapters/ai";
import type { ExecutionContext } from "../../context";
import type { RuntimeInput } from "../../types";
import type { Phase, PhaseResult } from "../types";

import { executeActPhase } from "../../phases/act";

export class ActPhase implements Phase<RuntimeInput, void> {
  readonly id = "act";

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
      const authz = context.get("authz") as string | undefined;
      const scanContext = context.get("scanContext") as
        | ExecutionContext
        | null
        | undefined;
      const planSummary = context.get("planSummary") as
        | string
        | null
        | undefined;
      const userId = context.get("userId") as string | undefined;
      const projectId = context.get("projectId") as string | undefined;
      const autonomyLevel = context.get("autonomyLevel") as number | undefined;
      const cognitivePhysiology = context.get("cognitivePhysiology") as
        | Record<string, unknown>
        | undefined;

      const shouldForceSequential =
        (typeof autonomyLevel === "number" && autonomyLevel < 0.65) ||
        (cognitivePhysiology &&
          typeof cognitivePhysiology.frustration === "number" &&
          cognitivePhysiology.frustration > 0.75);

      const effectiveMode =
        input.mode ?? (shouldForceSequential ? "sequential" : "parallel");
      const effectiveToolgraph =
        shouldForceSequential && effectiveMode === "sequential"
          ? {
              ...(input.toolgraph ?? {}),
              maxParallel: 1,
            }
          : input.toolgraph;

      const steeredInput: RuntimeInput =
        effectiveMode === input.mode && effectiveToolgraph === input.toolgraph
          ? input
          : {
              ...input,
              mode: effectiveMode,
              toolgraph: effectiveToolgraph,
            };

      const generator = executeActPhase(
        steeredInput,
        this.runId,
        signal,
        this.model,
        undefined,
        undefined,
        authz,
        scanContext ?? undefined,
        planSummary ?? undefined,
        userId,
        this.createAiAdapter
          ? { createAiAdapter: this.createAiAdapter }
          : undefined,
        projectId,
        {
          autonomyLevel:
            typeof autonomyLevel === "number" ? autonomyLevel : undefined,
          physiology: cognitivePhysiology,
        }
      );
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
