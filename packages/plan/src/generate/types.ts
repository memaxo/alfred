import { z } from "zod";
import type { Phase, StructuredPlan } from "../types.js";
import type { WavePlan } from "@alfred/agent/orchestrator/multi/spawn";

/**
 * AgentType: The type of agent assigned to a phase
 */
export const agentTypeSchema = z.enum([
  "codex",
  "research",
  "review",
  "orchestrator",
  "droid",
  "claude-code",
]);
export type AgentType = z.infer<typeof agentTypeSchema>;

/**
 * SubTask: A single unit of work within a phase
 * Based on @alfred/agent/orchestrator/multi/decompose.ts
 */
export const subTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  requirement: z.string(),
  deps: z.array(z.string()),
  priority: z.number(),
  acceptance: z.array(z.string()),
  filesHint: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SubTask = z.infer<typeof subTaskSchema>;

/**
 * Phase: A group of subtasks with a common goal and dependencies
 */
export const phaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tasks: z.array(subTaskSchema),
  dependsOn: z.array(z.string()), // IDs of phases this phase depends on
  estimatedDurationMs: z.number(),
  agentType: agentTypeSchema,
});

/**
 * StructuredPlan: The final output of the phased plan generator
 */
export const structuredPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  intent: z.string(),
  workspace: z.string().optional(), // Workspace path for checks
  phases: z.array(phaseSchema),
  waves: z
    .array(
      z.object({
        id: z.string(),
        agents: z.array(z.string()),
        dependsOn: z.array(z.string()),
        agentType: z.string().optional(),
        isolation: z.enum(["container", "worktree"]).optional(),
        phaseId: z.string().optional(),
      }) satisfies z.ZodType<WavePlan>
    )
    .optional(),
  resources: z.object({
    agentCount: z.number(),
    strategy: z.enum(["sequential", "parallel", "mixed", "topological"]),
    isolation: z.enum(["container", "worktree"]),
  }),
  evaluationCriteria: z.array(
    z.union([
      z.string(),
      z.object({
        name: z.string(),
        weight: z.number(),
        threshold: z.string(),
      }),
    ])
  ),
}) satisfies z.ZodType<StructuredPlan>;

export type GeneratePlanOptions = {
  maxPhases?: number;
  preferParallel?: boolean;
  agentTypes?: AgentType[];
};

// Re-export core types
export type { Phase, StructuredPlan };
