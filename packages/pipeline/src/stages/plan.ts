import { logger } from "@alfred/logger";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { PipelineContext, PipelineStage } from "../pipeline";
import type { ContextOutput, PlanOutput } from "./types";

import { createEvent } from "../events";

export class PlanStage implements PipelineStage<ContextOutput, PlanOutput> {
  readonly name = "plan" as const;

  async execute(
    input: ContextOutput,
    ctx: PipelineContext
  ): Promise<PlanOutput> {
    ctx.emit(
      createEvent("stage:progress", {
        message: "Generating structured plan",
        stage: "plan",
      })
    );

    const planId = randomUUID();

    // Import dynamically to avoid circular dependencies and import-time work
    const { generateSubtaskExecPlanSkeleton } =
      await import("@alfred/agent/orchestrator/multi/execplan");
    const { structuredPlanSchema } = await import("@alfred/plan/schema");
    const { generatePlan } = await import("@alfred/plan/generate");
    const { researchResultSchema } = await import("@alfred/plan/research");

    const research = researchResultSchema.parse({
      external: [],
      internal: {
        conventions: [],
        existingCode: (input.bundle.files ?? [])
          .map((f) => f.path)
          .filter((p): p is string => typeof p === "string" && p.length > 0),
        patterns: [],
      },
      metadata: {
        researchDurationMs: 0,
        tokenCount: input.totalTokens ?? 0,
        totalSources: 0,
      },
    });

    const intent = {
      context: {
        workspace: ctx.workspace,
        existingPatterns: [],
        constraints: [],
      },
      description: ctx.requirement,
      id: randomUUID(),
      source: "chat" as const,
      timestamp: new Date(),
      userId: ctx.userId,
    };

    let structuredPlan: unknown;
    try {
      structuredPlan = await generatePlan(intent as never, research as never, {
        maxPhases: 6,
        preferParallel: ctx.config.maxParallel > 1,
      });
    } catch (error) {
      // Fallback: build a deterministic plan from bucket-based subtasks
      const { decomposeTask } =
        await import("@alfred/agent/orchestrator/multi/decompose");
      const subtasks = decomposeTask(ctx.requirement, {
        bundle: input.bundle,
      } as Parameters<typeof decomposeTask>[1]);

      const phases = [
        {
          agentType: "codex",
          dependsOn: [],
          description:
            "Deterministic fallback plan (AI planning unavailable). Execute the subtasks safely in order.",
          estimatedDurationMs: Math.max(60_000, subtasks.length * 120_000),
          id: "phase-1",
          name: "Execution",
          tasks: subtasks,
        },
      ];

      structuredPlan = {
        evaluationCriteria: [],
        id: planId,
        intent: ctx.requirement,
        phases,
        resources: {
          agentCount: Math.max(1, Math.min(ctx.config.maxParallel, 5)),
          strategy: ctx.config.maxParallel > 1 ? "parallel" : "sequential",
          isolation: "agentfs",
        },
        title: ctx.requirement.length > 0 ? ctx.requirement : "Plan",
        workspace: ctx.workspace,
      };

      logger.warn("structured_plan_generation_failed_fallback", {
        error: error instanceof Error ? error.message : String(error),
        runId: ctx.runId,
      });
    }

    const planParsed = structuredPlanSchema.parse(structuredPlan);
    // Canonicalize: use the persisted planId as the plan.id
    let canonicalPlan = { ...planParsed, id: planId };

    // Guard: ensure we always have at least one subtask to execute.
    if (canonicalPlan.phases.every((p) => p.tasks.length === 0)) {
      const fallbackTaskId = `T-${randomUUID().slice(0, 8)}`;
      const first = canonicalPlan.phases[0];
      canonicalPlan = {
        ...canonicalPlan,
        phases: first
          ? [
              {
                ...first,
                tasks: [
                  {
                    acceptance: ["Change implemented and tests pass."],
                    deps: [],
                    filesHint: [],
                    id: fallbackTaskId,
                    priority: 1,
                    requirement: ctx.requirement,
                    title: "Implement change",
                  },
                ],
              },
              ...canonicalPlan.phases.slice(1),
            ]
          : [
              {
                agentType: "codex",
                dependsOn: [],
                description:
                  "Fallback plan (no tasks were produced). Execute a minimal task safely.",
                estimatedDurationMs: 120_000,
                id: "phase-1",
                name: "Execution",
                tasks: [
                  {
                    id: fallbackTaskId,
                    title: "Implement change",
                    requirement: ctx.requirement,
                    deps: [],
                    priority: 1,
                    acceptance: ["Change implemented and tests pass."],
                    filesHint: [],
                  },
                ],
              },
            ],
      };
    }

    ctx.emit(
      createEvent("stage:progress", {
        message: `Generated ${canonicalPlan.phases.length} phases`,
        stage: "plan",
      })
    );

    const subtasks = canonicalPlan.phases.flatMap((p) => p.tasks);

    // Create ExecPlan files
    const plansDir = join(ctx.workspace, ".agent", "plans", ctx.runId);
    await mkdir(plansDir, { recursive: true });

    // Create root plan (simple markdown file)
    const rootPlanPath = join(plansDir, "root.md");
    const rootPlanContent = `# Root ExecPlan: ${ctx.requirement}

Run ID: ${ctx.runId}
Requirement: ${ctx.requirement}

## Subtasks

${subtasks.map((st, idx) => `${idx + 1}. ${st.title} (${st.id})`).join("\n")}

## Progress

(To be updated during execution)

## Decision Log

(To be updated during execution)

## Outcomes & Retrospective

(To be completed at end of execution)
`;
    await writeFile(rootPlanPath, rootPlanContent, "utf8");

    // Create subtask skeletons using actual function
    const execPlans = new Map<string, string>();
    for (const subtask of subtasks) {
      const subtaskPath = join(plansDir, `${subtask.id}.md`);
      const skeletonContent = generateSubtaskExecPlanSkeleton(
        subtask as never,
        ctx.runId
      );
      await writeFile(subtaskPath, skeletonContent, "utf8");
      execPlans.set(subtask.id, subtaskPath);
    }

    logger.info("plan_stage_complete", {
      planId,
      rootPlanPath,
      runId: ctx.runId,
      subtaskCount: subtasks.length,
    });

    // Store useful plan outputs in context for later stages / resume.
    // Note: PipelineRunner also stores `${stage}Output`, but other stages may
    // read these convenience keys.
    ctx.set("planId", planId);
    ctx.set("structuredPlan", canonicalPlan);
    ctx.set("subtasks", subtasks);
    ctx.set("execPlans", execPlans);
    ctx.set("rootPlanPath", rootPlanPath);

    return {
      execPlans,
      planId,
      rootPlanPath,
      structuredPlan: canonicalPlan,
      subtasks,
    };
  }
}
