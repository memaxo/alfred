import type { ExecutionPlan, ExecutionStep } from "@alfred/cognitive";
import { executing, initialAutonomy } from "@alfred/cognitive/state";
import { cognitiveRepo } from "@alfred/db";
import { logger } from "@alfred/logger";

export type StepResult = {
  status: "completed" | "failed" | "suspended";
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
    const lastEventId =
      latestSnapshot?.lastEventId || "00000000-0000-0000-0000-000000000000";
    const currentAutonomy =
      (latestSnapshot?.state as any)?.auto || initialAutonomy();
    const retryCount = ((latestSnapshot?.state as any)?.retryCount ?? 0) + 1;

    for (let i = startStep; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (!step) {
        continue;
      }

      // Checkpoint execution state
      try {
        const state = executing(plan as any, currentAutonomy);
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
      const result = await this.executeStep(step, this.tools);

      if (result.status === "suspended") {
        logger.info("plan_runner_suspended", { streamId: this.streamId, step: i });
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
