import { decomposeTask } from "./decompose.js";
import { logger } from "@alfred/logger";
import type { WorkflowIntent } from "../intent/types.js";
import type { ResearchResult } from "../research/types.js";
import { assignAgentTypes } from "./agents.js";
import { buildDependencyGraph } from "./dependencies.js";
import { estimateDurations } from "./duration.js";
import { groupIntoPhases } from "./group.js";
import type {
  GeneratePlanOptions,
  Phase,
  StructuredPlan,
  SubTask,
} from "./types.js";
import { generateObject } from "ai";
import { z } from "zod";
import { getOpenAI, getModelId } from "../ai.js";

/**
 * Generate a phased plan from intent and research
 */
export async function generatePlan(
  intent: WorkflowIntent,
  research: ResearchResult,
  options?: GeneratePlanOptions
): Promise<StructuredPlan> {
  const startTime = Date.now();

  // 1. Decompose intent into SubTasks using existing orchestrator logic
  // We provide a minimal bundle since we don't have file contents here yet
  const subtasks = await decomposeTask(intent.description, {
    requirement: intent.description,
    bundle: {
      maxTokens: 0,
      estimatedTokens: 0,
      files: research.internal.existingCode.map((path) => ({
        path,
        content: "", // Content will be loaded by agents later
        startLine: 0,
        endLine: 0,
        tokens: 0,
      })),
    },
  });

  // 2. Group subtasks into phases using heuristics
  const phaseGroups = groupIntoPhases(subtasks, {
    maxPhases: options?.maxPhases ?? 5,
    preferParallel: options?.preferParallel ?? true,
  });

  // 3. Convert groups to Phase objects and use LLM to generate names/descriptions
  const phases = await enrichPhasesWithAI(intent, research, phaseGroups);

  // 4. Build dependency graph
  const phasesWithDeps = buildDependencyGraph(phases);

  // 5. Assign agent types
  const phasesWithAgents = assignAgentTypes(phasesWithDeps);

  // 6. Estimate durations
  const estimatedPhases = estimateDurations(phasesWithAgents);

  // 7. Create StructuredPlan
  const plan: StructuredPlan = {
    id: crypto.randomUUID(),
    title: extractTitle(intent.description),
    intent: intent.description,
    phases: estimatedPhases,
    resources: {
      agentCount: countUniqueAgents(estimatedPhases),
      strategy: determineStrategy(estimatedPhases),
      isolation: "container",
    },
    evaluationCriteria: generateEvaluationCriteria(intent),
  };

  logger.info("plan_generated", {
    id: plan.id,
    durationMs: Date.now() - startTime,
    phases: plan.phases.length,
    tasks: subtasks.length,
  });

  return plan;
}

/**
 * Use LLM to enrich phase groups with better names and descriptions
 */
async function enrichPhasesWithAI(
  intent: WorkflowIntent,
  research: ResearchResult,
  groups: Array<{ name: string; subtasks: SubTask[] }>
): Promise<Phase[]> {
  try {
    const { object } = await generateObject({
      model: getOpenAI()(getModelId()),
      schema: z.object({
        phases: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
          })
        ),
      }),
      prompt: `Generate professional names and descriptions for the following workflow phases.
User Intent: ${intent.description}
Project Framework: ${research.internal.conventions.find(c => c.id.includes('import'))?.description ?? 'Unknown'}

Phases:
${groups
  .map(
    (g, i) =>
      `Phase ${i + 1}: ${g.name}\nTasks:\n${g.subtasks
        .map((t) => `- ${t.title}`)
        .join("\n")}`
  )
  .join("\n\n")}

Return JSON matching the schema.`,
    });

    return groups.map((group, i) => ({
      id: `phase-${i + 1}`,
      name: object.phases[i]?.name ?? group.name,
      description:
        object.phases[i]?.description ??
        `Execution of ${group.subtasks.length} tasks for ${group.name}`,
      tasks: group.subtasks,
      dependsOn: [],
      estimatedDurationMs: 0,
      agentType: "codex",
    }));
  } catch (error) {
    logger.warn("ai_phase_enrichment_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fallback to basic names
    return groups.map((group, i) => ({
      id: `phase-${i + 1}`,
      name: group.name,
      description: `Phase ${i + 1}: ${group.name}`,
      tasks: group.subtasks,
      dependsOn: [],
      estimatedDurationMs: 0,
      agentType: "codex",
    }));
  }
}

function extractTitle(description: string): string {
  const firstLine = description.split("\n")[0];
  return (firstLine ?? description).slice(0, 50);
}

function countUniqueAgents(phases: Phase[]): number {
  return new Set(phases.map((p) => p.agentType)).size;
}

function determineStrategy(phases: Phase[]): StructuredPlan["resources"]["strategy"] {
  const hasDeps = phases.some((p) => p.dependsOn.length > 0);
  if (!hasDeps) return "parallel";
  // Check if some can run in parallel
  const canRunParallel = phases.some(p1 => 
    !phases.some(p2 => p2.dependsOn.includes(p1.id)) && 
    p1.dependsOn.length === 0
  );
  return hasDeps && canRunParallel ? "mixed" : "sequential";
}

function generateEvaluationCriteria(_intent: WorkflowIntent): Array<{ name: string; weight: number; threshold: string }> {
  return [
    {
      name: "Functional correctness",
      weight: 0.4,
      threshold: "Implementation satisfies the intent.",
    },
    {
      name: "Conventions",
      weight: 0.2,
      threshold: "Follows project naming and structure.",
    },
    {
      name: "Test coverage",
      weight: 0.2,
      threshold: "New logic is covered by tests.",
    },
    {
      name: "Regressions",
      weight: 0.2,
      threshold: "No existing functionality is broken.",
    },
  ];
}
