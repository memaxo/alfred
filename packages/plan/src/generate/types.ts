import { z } from "zod";
import type { Phase, StructuredPlan } from "../types.js";

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
  id: z.string().uuid().or(z.string()),
  title: z.string(),
  intent: z.string(),
  workspace: z.string().optional(), // Workspace path for checks
  phases: z.array(phaseSchema),
  waves: z.array(z.unknown()).optional(),
  resources: z.object({
    agentCount: z.number(),
    strategy: z.enum(["sequential", "parallel", "mixed", "topological"]),
    isolation: z.enum(["container", "worktree", "none"]),
  }),
  evaluationCriteria: z.array(z.any()), // More flexible criteria
});

export type GeneratePlanOptions = {
  maxPhases?: number;
  preferParallel?: boolean;
  agentTypes?: AgentType[];
};

// Re-export core types
export type { Phase, StructuredPlan };
