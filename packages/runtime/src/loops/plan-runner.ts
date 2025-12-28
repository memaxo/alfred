import { wrapEventEnvelope } from "@alfred/agent/utils/envelope";
import type { ExecutionPlan, ExecutionStep } from "@alfred/cognitive";
import type { RiskAssessment } from "@alfred/cognitive/logic/autonomy";
import { shouldGateExecution } from "@alfred/cognitive/logic/autonomy";
import type { Plan as CognitivePlan } from "@alfred/cognitive/state";
import { executing, initialAutonomy } from "@alfred/cognitive/state";
import { cognitiveRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { classifyPlanRisk } from "../engines/safety";

export type StepResult = {
  status: "completed" | "failed" | "suspended";
  output?: unknown;
  error?: string;
};

type ToolExecuteContext = {
  toolCallId: string;
  messages: unknown[];
};

type ToolLike = {
  execute: (input: unknown, ctx: ToolExecuteContext) => Promise<unknown>;
};

type CognitiveRepo = Pick<
  typeof cognitiveRepo,
  "getLatestSnapshot" | "saveSnapshot" | "appendEvent"
>;

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
    private readonly tools: Record<string, ToolLike>,
    private readonly repo: CognitiveRepo = cognitiveRepo
  ) {}

  async executePlan(plan: ExecutionPlan, startStep = 0): Promise<void> {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value);

    // Get initial lastEventId (needed for snapshots)
    const latestSnapshot = await this.repo.getLatestSnapshot(this.streamId);
    let lastEventId =
      latestSnapshot?.lastEventId || "00000000-0000-0000-0000-000000000000";
    const snapshotState = latestSnapshot?.state;
    const snapshotRecord = isRecord(snapshotState) ? snapshotState : null;
    const autoCandidate = snapshotRecord?.auto;
    const currentAutonomy =
      isRecord(autoCandidate) && typeof autoCandidate.level === "number"
        ? (autoCandidate as ReturnType<typeof initialAutonomy>)
        : initialAutonomy(Date.now());
    const retryCandidate = snapshotRecord?.retryCount;
    const retryCount =
      (typeof retryCandidate === "number" && Number.isFinite(retryCandidate)
        ? retryCandidate
        : 0) + 1;

    await this.enforceSafetyGate(plan, currentAutonomy);

    for (let i = startStep; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (!step) {
        continue;
      }

      // Checkpoint execution state
      try {
        const planForState: CognitivePlan = {
          steps: plan.steps.map((step) => ({
            action: step.action,
            params: step.params as Record<string, unknown>,
            timeout: step.timeout,
            retryable: step.retryable,
          })),
          duration: plan.duration,
          confidence: Math.max(
            0,
            Math.min(1, plan.confidence)
          ) as unknown as CognitivePlan["confidence"],
        };
        const state = executing(Date.now(), planForState, currentAutonomy);
        const persistedState: Record<string, unknown> = {
          ...(state as unknown as Record<string, unknown>),
          step: i,
          retryCount,
        };

        await this.repo.saveSnapshot(
          this.streamId,
          persistedState,
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
        const envelope = wrapEventEnvelope({
          id: crypto.randomUUID(),
          type: "cognitive_step_complete",
          resource: "user",
          data: event,
        });
        const inserted = await this.repo.appendEvent(
          this.streamId,
          "cognitive_step_complete",
          {
            v: envelope.v,
            id: envelope.id,
            type: envelope.type,
            createdAt: envelope.createdAt,
            resource: envelope.resource,
            data: envelope.data,
          }
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
    tools: Record<string, ToolLike>
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
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "suspended" || error.name === "SuspendedError")
      ) {
        return { status: "suspended" };
      }
      return {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
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
    return;
  }

  // Avoid throwing on complex/non-serializable tool outputs.
  try {
    const json = JSON.stringify(output);
    return json.length > 1000 ? `${json.slice(0, 1000)}…` : json;
  } catch {
    return "[unserializable_output]";
  }
}
