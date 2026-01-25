import { z } from "zod";

import type { PlanEvaluation } from "../types.js";

import {
  type StructuredPlan,
  structuredPlanSchema,
} from "../generate/types.js";

/**
 * PlanCritiqueIssue: A single issue identified in a plan
 */
export const planCritiqueIssueSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  phaseId: z.string().optional(),
  description: z.string(),
  suggestion: z.string(),
});
export type PlanCritiqueIssue = z.infer<typeof planCritiqueIssueSchema>;

/**
 * PlanCritique: The result of evaluating a plan
 */
export const planCritiqueSchema = z.object({
  issues: z.array(planCritiqueIssueSchema),
  overallScore: z.number().min(0).max(1), // 0.0 to 1.0
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
});
export type PlanCritique = z.infer<typeof planCritiqueSchema>;

/**
 * PlanCritiqueResult: The final output of the critique function
 */
export const planCritiqueResultSchema = z.object({
  critique: planCritiqueSchema,
  revisedPlan: structuredPlanSchema.optional(),
  iterations: z.number().int().min(0),
});
export type PlanCritiqueResult = z.infer<typeof planCritiqueResultSchema>;

export interface CritiqueOptions {
  maxRevisions?: number;
  abortSignal?: AbortSignal;
}

/**
 * CheckResult: The result of a single deterministic check
 */
export const checkResultSchema = z.object({
  success: z.boolean(),
  output: z.string().optional(),
  error: z.string().optional(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

/**
 * VerificationResult: The aggregate result of multiple checks
 */
export const verificationResultSchema = z.object({
  passes: z.boolean(),
  passed: z.array(z.string()),
  failed: z.array(z.string()),
  details: z.record(z.string(), checkResultSchema),
});
export type VerificationResult = z.infer<typeof verificationResultSchema>;

/**
 * EvaluationScore: A single score from a judge/judge-type
 */
export const evaluationScoreSchema = z.object({
  judge: z.string(),
  criterion: z.string(),
  score: z.number().min(0).max(1),
  reasoning: z.string(),
});
export type EvaluationScore = z.infer<typeof evaluationScoreSchema>;

/**
 * PlanEvaluation: The final result of plan evaluation
 */
export const planEvaluationSchema = z.object({
  planId: z.string(),
  scores: z.array(evaluationScoreSchema),
  aggregateScore: z.number().min(0).max(1),
  selected: z.boolean(),
});

/**
 * EvaluationRubric: Criteria for tie-breaks
 */
export interface EvaluationRubric {
  criteria: {
    name: string;
    weight: number;
    evaluate: (plan: StructuredPlan) => number | Promise<number>;
  }[];
}

export type { PlanEvaluation };
