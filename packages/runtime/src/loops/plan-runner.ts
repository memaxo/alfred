import { getAssistantAgentDefaults } from "@alfred/agent";
import type { ExecutionPlan, ExecutionStep } from "@alfred/cognitive/schemas";
import { executing, initialAutonomy } from "@alfred/cognitive/state";
import { cognitiveRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import type { AIAdapter } from "@alfred/type/ai-adapter";
import type { RuntimeContext } from "@alfred/type/runtime-context";

export type StepResult = {
  success: boolean;
  output?: unknown;
  error?: string;
};

export class PlanRunner {
  constructor(
    private readonly ctx: RuntimeContext,
    private readonly ai: AIAdapter,
    private readonly streamId: string
  ) {
    void this.ctx;
    void this.ai;
  }

  async executePlan(plan: ExecutionPlan, startStep = 0): Promise<void> {
    const tools = getAssistantAgentDefaults().tools;

    // Get initial lastEventId (needed for snapshots)
    const latestSnapshot = await cognitiveRepo.getLatestSnapshot(this.streamId);
    const lastEventId =
      latestSnapshot?.lastEventId || "00000000-0000-0000-0000-000000000000";
    const currentAutonomy =
      (latestSnapshot?.state as any)?.auto || initialAutonomy();

    for (let i = startStep; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (!step) {
        continue;
      }

      // Checkpoint execution state
      try {
        const state = executing(plan as any, currentAutonomy);
        (state as any).step = i;

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
      const result = await this.executeStep(step, tools);

      if (!result.success) {
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
      return { success: false, error: `Tool not found: ${step.action}` };
    }

    try {
      // Execute the tool
      // Note: AI SDK tools might need specific calling convention
      const output = await tool.execute(step.params, {
        toolCallId: `call-${Date.now()}`,
        messages: [], // Context might be needed
      });

      return { success: true, output };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
