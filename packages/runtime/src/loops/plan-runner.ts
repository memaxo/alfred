import type { ExecutionPlan, ExecutionStep } from "@alfred/cognitive";
import type { RiskAssessment } from "@alfred/cognitive/logic/autonomy";
import { shouldGateExecution } from "@alfred/cognitive/logic/autonomy";
import { executing, initialAutonomy } from "@alfred/cognitive/state";
import { cognitiveRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { classifyPlanRisk } from "../engines/safety";

export type StepResult = {
  status: "completed" | "failed" | "suspended";
  output?: unknown;
  error?: string;
};

type CognitiveStepCompleteEvent = {
  _: "cognitive_step_complete";
  ts: number;
  step: number;
  action: string;
  description?: string;
  status: StepResult["status"];
  durationMs: number;
  output?: unknown;
  error?: string;
};

export class PlanRunner {
  constructor(
    private readonly streamId: string,
    private readonly tools: Record<string, any>
  ) {}

  async executePlan(plan: ExecutionPlan, startStep = 0): Promise<void> {
    // Get initial lastEventId (needed for snapshots)
    const latestSnapshot = await cognitiveRepo.getLatestSnapshot(this.streamId);
    let lastEventId =
      latestSnapshot?.lastEventId || "00000000-0000-0000-0000-000000000000";
    const currentAutonomy =
      (latestSnapshot?.state as any)?.auto || initialAutonomy(Date.now());
    const retryCount = ((latestSnapshot?.state as any)?.retryCount ?? 0) + 1;

    await this.enforceSafetyGate(plan, currentAutonomy);

    for (let i = startStep; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (!step) {
        continue;
      }

      // Checkpoint execution state
      try {
        const state = executing(Date.now(), plan as any, currentAutonomy);
        (state as any).step = i;
        (state as any).retryCount = retryCount; // Persist retry count

        await cognitiveRepo.saveSnapshot(
          this.streamId,
          state as any,
          lastEventId
        );
      } catch (err) {
        logger.warn("plan_runner_checkpoint_failed", {
          streamId: this.streamId,
          step: i,
          error: String(err),
        });
      }

      // console.log(`Executing step: ${step.description}`);
      const stepStartedAt = Date.now();
      const result = await this.executeStep(step, this.tools);
      const stepDurationMs = Date.now() - stepStartedAt;

      // Emit explicit per-step completion event for observability.
      try {
        const event = this.buildStepCompleteEvent(
          i,
          step,
          result,
          stepDurationMs
        );
        const inserted = await cognitiveRepo.appendEvent(
          this.streamId,
          "cognitive_step_complete",
          event as unknown as Record<string, unknown>
        );
        if (inserted?.id) {
          lastEventId = inserted.id;
        }
      } catch (err) {
        logger.warn("plan_runner_step_complete_event_failed", {
          streamId: this.streamId,
          step: i,
          action: step.action,
          error: String(err),
        });
      }

      if (result.status === "suspended") {
        logger.info("plan_runner_suspended", {
          streamId: this.streamId,
          step: i,
        });
        // Save state as suspended? Or just exit and let resume pick it up?
        // If we exit, 'activePlans' query needs to know it's not just crashed.
        // But for now, simple exit is fine.
        return;
      }

      if (result.status === "failed") {
        // Fail fast for now - in future, trigger replanning
        throw new Error(`Step failed: ${step.action} - ${result.error}`);
      }
    }
  }

  private buildStepCompleteEvent(
    stepIndex: number,
    step: ExecutionStep,
    result: StepResult,
    durationMs: number
  ): CognitiveStepCompleteEvent {
    const base: CognitiveStepCompleteEvent = {
      _: "cognitive_step_complete",
      ts: Date.now(),
      step: stepIndex,
      action: step.action,
      description: step.description,
      status: result.status,
      durationMs,
    };

    if (result.status === "failed") {
      return { ...base, error: result.error ?? "unknown_error" };
    }

    if (result.status === "completed") {
      const summary = summarizeStepOutput(result.output);
      if (summary !== undefined) {
        return { ...base, output: summary };
      }
    }

    return base;
  }

  private async enforceSafetyGate(
    plan: ExecutionPlan,
    autonomy: ReturnType<typeof initialAutonomy>
  ): Promise<RiskAssessment> {
    const assessment = await classifyPlanRisk(plan);
    const autonomyLevel = Number(autonomy.level ?? 0);
    const gate = shouldGateExecution(autonomyLevel, assessment);

    if (gate.gated) {
      logger.warn("plan_runner_autonomy_blocked", {
        streamId: this.streamId,
        level: gate.level,
        required: gate.required,
        current: autonomyLevel,
        score: assessment.score ?? null,
        anchors: assessment.anchors ?? [],
      });

      const requiredText = gate.required.toFixed(2);
      const currentText = autonomyLevel.toFixed(2);
      throw new Error(
        `Execution gated: autonomy ${currentText} < required ${requiredText} for ${gate.level} risk plan (score ${assessment.score ?? 0}).`
      );
    }

    return assessment;
  }

  private async executeStep(
    step: ExecutionStep,
    tools: Record<string, any>
  ): Promise<StepResult> {
    const tool = tools[step.action];

    if (!tool) {
      return { status: "failed", error: `Tool not found: ${step.action}` };
    }

    try {
      // Execute the tool
      // Note: AI SDK tools might need specific calling convention
      const output = await tool.execute(step.params, {
        toolCallId: `call-${Date.now()}`,
        messages: [], // Context might be needed
      });

      return { status: "completed", output };
    } catch (error: any) {
      if (error.message === "suspended" || error.name === "SuspendedError") {
        return { status: "suspended" };
      }
      return { status: "failed", error: error.message };
    }
  }
}

function summarizeStepOutput(output: unknown): unknown {
  if (output === null) {
    return null;
  }
  if (typeof output === "string") {
    return output.length > 1000 ? `${output.slice(0, 1000)}…` : output;
  }
  if (typeof output === "number" || typeof output === "boolean") {
    return output;
  }
  if (typeof output === "undefined") {
    return undefined;
  }

  // Avoid throwing on complex/non-serializable tool outputs.
  try {
    const json = JSON.stringify(output);
    return json.length > 1000 ? `${json.slice(0, 1000)}…` : json;
  } catch {
    return "[unserializable_output]";
  }
}
