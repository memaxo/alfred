import { randomUUID } from "node:crypto";
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
        message: "Generating structured plan",
      })
    );

    const planId = randomUUID();

    // Import dynamically to avoid circular dependencies and import-time work
    const { generateSubtaskExecPlanSkeleton } = await import(
      "@alfred/agent/orchestrator/multi/execplan"
    );
    const { structuredPlanSchema } = await import("@alfred/plan/schema");
    const { generatePlan } = await import("@alfred/plan/generate");
    const { researchResultSchema } = await import("@alfred/plan/research");

    const research = researchResultSchema.parse({
      external: [],
      internal: {
        existingCode: (input.bundle.files ?? [])
          .map((f) => f.path)
          .filter((p): p is string => typeof p === "string" && p.length > 0),
        patterns: [],
        conventions: [],
      },
      metadata: {
        totalSources: 0,
        tokenCount: input.totalTokens ?? 0,
        researchDurationMs: 0,
      },
    });

    const intent = {
      id: randomUUID(),
      description: ctx.requirement,
      source: "chat" as const,
      userId: ctx.userId,
      timestamp: new Date(),
      context: {
        workspace: ctx.workspace,
        existingPatterns: [],
        constraints: [],
      },
    };

    let structuredPlan: unknown;
    try {
      structuredPlan = await generatePlan(intent as never, research as never, {
        preferParallel: ctx.config.maxParallel > 1,
        maxPhases: 6,
      });
    } catch (error) {
      // Fallback: build a deterministic plan from bucket-based subtasks
      const { decomposeTask } = await import(
        "@alfred/agent/orchestrator/multi/decompose"
      );
      const subtasks = decomposeTask(ctx.requirement, {
        bundle: input.bundle,
      } as Parameters<typeof decomposeTask>[1]);

      const phases = [
        {
          id: "phase-1",
          name: "Execution",
          description:
            "Deterministic fallback plan (AI planning unavailable). Execute the subtasks safely in order.",
          tasks: subtasks,
          dependsOn: [],
          estimatedDurationMs: Math.max(60_000, subtasks.length * 120_000),
          agentType: "codex",
        },
      ];

      structuredPlan = {
        id: planId,
        title: ctx.requirement.length > 0 ? ctx.requirement : "Plan",
        intent: ctx.requirement,
        workspace: ctx.workspace,
        phases,
        resources: {
          agentCount: Math.max(1, Math.min(ctx.config.maxParallel, 5)),
          strategy: ctx.config.maxParallel > 1 ? "parallel" : "sequential",
          isolation: "agentfs",
        },
        evaluationCriteria: [],
      };

      logger.warn("structured_plan_generation_failed_fallback", {
        runId: ctx.runId,
        error: error instanceof Error ? error.message : String(error),
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
              ...canonicalPlan.phases.slice(1),
            ]
          : [
              {
                id: "phase-1",
                name: "Execution",
                description:
                  "Fallback plan (no tasks were produced). Execute a minimal task safely.",
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
                dependsOn: [],
                estimatedDurationMs: 120_000,
                agentType: "codex",
              },
            ],
      };
    }

    ctx.emit(
      createEvent("stage:progress", {
        stage: "plan",
        message: `Generated ${canonicalPlan.phases.length} phases`,
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
    await writeFile(rootPlanPath, rootPlanContent, "utf-8");

    // Create subtask skeletons using actual function
    const execPlans = new Map<string, string>();
    for (const subtask of subtasks) {
      const subtaskPath = join(plansDir, `${subtask.id}.md`);
      const skeletonContent = generateSubtaskExecPlanSkeleton(
        subtask as never,
        ctx.runId
      );
      await writeFile(subtaskPath, skeletonContent, "utf-8");
      execPlans.set(subtask.id, subtaskPath);
    }

    logger.info("plan_stage_complete", {
      runId: ctx.runId,
      planId,
      subtaskCount: subtasks.length,
      rootPlanPath,
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
      planId,
      structuredPlan: canonicalPlan,
      subtasks,
      execPlans,
      rootPlanPath,
    };
  }
}
