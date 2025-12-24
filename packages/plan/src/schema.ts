import { z } from "zod";

/**
 * Zod schema for Phase
 */
export const phaseSchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string().min(1),
  description: z.string(),
  tasks: z.array(z.unknown()), // SubTask validation deferred to @alfred/agent
  dependsOn: z.array(z.string()),
  estimatedDurationMs: z.number().min(0),
  agentType: z.enum(["codex", "droid", "claude-code", "research", "review"]),
});

/**
 * Zod schema for StructuredPlan
 */
export const structuredPlanSchema = z.object({
  id: z.string().uuid().or(z.string()),
  title: z.string().min(1),
  intent: z.string().min(1),
  phases: z.array(phaseSchema),
  waves: z.array(z.unknown()).optional(), // WavePlan validation deferred to @alfred/agent
  resources: z.object({
    agentCount: z.number().min(1),
    strategy: z.enum(["sequential", "parallel", "topological"]),
    isolation: z.enum(["container", "worktree"]),
  }),
  evaluationCriteria: z.array(
    z.object({
      name: z.string(),
      weight: z.number().min(0).max(1),
      threshold: z.string(),
    })
  ),
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
