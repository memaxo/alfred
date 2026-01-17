import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@alfred/logger";
import { createEvent } from "../events";
import type { PipelineContext, PipelineStage } from "../pipeline";
import type { ContextOutput, PlanOutput } from "./types";

export class PlanStage implements PipelineStage<ContextOutput, PlanOutput> {
  readonly name = "plan" as const;

  async execute(
    input: ContextOutput,
    ctx: PipelineContext
  ): Promise<PlanOutput> {
    ctx.emit(
      createEvent("stage:progress", {
        stage: "plan",
        message: "Decomposing task into subtasks",
      })
    );

    // Import dynamically to avoid circular dependencies
    const { decomposeTask } = await import(
      "@alfred/agent/orchestrator/multi/decompose"
    );
    const { generateSubtaskExecPlanSkeleton } = await import(
      "@alfred/agent/orchestrator/multi/execplan"
    );

    // Decompose using existing function
    const decomposed = decomposeTask(ctx.requirement, {
      bundle: input.bundle,
    } as Parameters<typeof decomposeTask>[1]);

    ctx.emit(
      createEvent("stage:progress", {
        stage: "plan",
        message: `Decomposed into ${decomposed.length} subtasks`,
      })
    );

    // Create ExecPlan files
    const plansDir = join(ctx.workspace, ".agent", "plans", ctx.runId);
    await mkdir(plansDir, { recursive: true });

    // Create root plan (simple markdown file)
    const rootPlanPath = join(plansDir, "root.md");
    const rootPlanContent = `# Root ExecPlan: ${ctx.requirement}

Run ID: ${ctx.runId}
Requirement: ${ctx.requirement}

## Subtasks

${decomposed.map((st, idx) => `${idx + 1}. ${st.title} (${st.id})`).join("\n")}

## Progress

(To be updated during execution)

## Decision Log

(To be updated during execution)

## Outcomes & Retrospective

(To be completed at end of execution)
`;
    await writeFile(rootPlanPath, rootPlanContent, "utf-8");

    // Create subtask skeletons using actual function
    const execPlans = new Map<string, string>();
    for (const subtask of decomposed) {
      const subtaskPath = join(plansDir, `${subtask.id}.md`);
      const skeletonContent = generateSubtaskExecPlanSkeleton(
        subtask,
        ctx.runId
      );
      await writeFile(subtaskPath, skeletonContent, "utf-8");
      execPlans.set(subtask.id, subtaskPath);
    }

    logger.info("plan_stage_complete", {
      runId: ctx.runId,
      subtaskCount: decomposed.length,
      rootPlanPath,
    });

    // Store useful plan outputs in context for later stages / resume.
    // Note: PipelineRunner also stores `${stage}Output`, but other stages may
    // read these convenience keys.
    ctx.set("subtasks", decomposed);
    ctx.set("execPlans", execPlans);
    ctx.set("rootPlanPath", rootPlanPath);

    return {
      subtasks: decomposed,
      execPlans,
      rootPlanPath,
    };
  }
}
