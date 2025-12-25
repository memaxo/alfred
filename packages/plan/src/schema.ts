import { z } from "zod";

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
});

/**
 * Zod schema for Phase
 */
export const phaseSchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string().min(1),
  description: z.string(),
  tasks: z.array(subTaskSchema),
  dependsOn: z.array(z.string()),
  estimatedDurationMs: z.number().min(0),
  agentType: z.enum([
    "codex",
    "droid",
    "claude-code",
    "research",
    "review",
    "orchestrator",
  ]),
});

/**
 * Zod schema for StructuredPlan
 */
export const structuredPlanSchema = z.object({
  id: z.string().uuid().or(z.string()),
  title: z.string().min(1),
  intent: z.string().min(1),
  workspace: z.string().optional(),
  phases: z.array(phaseSchema),
  waves: z.array(z.any()).optional(), // WavePlan validation deferred
  resources: z.object({
    agentCount: z.number().min(1),
    strategy: z.enum(["sequential", "parallel", "mixed", "topological"]),
    isolation: z.enum(["container", "worktree", "none"]),
  }),
  evaluationCriteria: z.array(z.any()),
});

/**
 * Zod schema for WorkflowPattern
 */
export const workflowPatternSchema = z.object({
  id: z.string().uuid().or(z.string()),
  trigger: z.string().min(1),
  planTemplate: structuredPlanSchema.omit({ id: true, intent: true }),
  successRate: z.number().min(0).max(1),
  avgDurationMs: z.number().min(0),
  usageCount: z.number().int().min(0),
  knowledgeNodeId: z.string().optional(),
});

/**
 * Zod schema for PlanEvaluation
 */
export const planEvaluationSchema = z.object({
  planId: z.string().uuid().or(z.string()),
  scores: z.array(
    z.object({
      judge: z.string(),
      criterion: z.string(),
      score: z.number().min(0).max(1),
      reasoning: z.string(),
    })
  ),
  aggregateScore: z.number().min(0).max(1),
  selected: z.boolean(),
});
