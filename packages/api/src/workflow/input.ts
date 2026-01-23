import { z } from "zod";

const workflowInputDataSchema = z.record(z.string(), z.unknown());

export function parseWorkflowInputData(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) {
    return {};
  }
  const result = workflowInputDataSchema.safeParse(val);
  if (!result.success) {
    // Back-compat: invalid legacy rows should not hard-fail callers.
    return {};
  }
  return result.data;
}

export const workflowInputSchema = z
  .object({
    requirement: z.string().min(1),
    auto: z.enum(["read", "low", "medium", "high"]).optional(),
    mode: z.string().optional(),
    projectId: z.string().optional(),
    planId: z.string().optional(),
    runId: z.string().optional(),
    linear: z.unknown().optional(),
    authzLinear: z.string().optional(),
  })
  .passthrough();

export const linearInputSchema = z.object({
  space: z.string().min(1),
  teamId: z.string().optional(),
  sessionId: z.string().optional(),
  issueId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  issueUrl: z.string().optional(),
});
