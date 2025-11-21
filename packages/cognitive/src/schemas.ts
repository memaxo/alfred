import { z } from "zod";

export const executionStepSchema = z.object({
  action: z.string(),
  params: z.record(z.string(), z.any()),
  description: z.string(),
  timeout: z.number().default(30_000),
  retryable: z.boolean().default(true),
});

export const executionPlanSchema = z.object({
  steps: z.array(executionStepSchema),
  goal: z.string(),
  duration: z.number(),
  confidence: z.number().min(0).max(1),
});

export type ExecutionStep = z.infer<typeof executionStepSchema>;
export type ExecutionPlan = z.infer<typeof executionPlanSchema>;
