import { z } from "zod";

export const workflowCompilationVersion = "workflow-compilation-v1" as const;

export const workflowCompilationFileChangesSchema = z.object({
  created: z.array(z.string()).default([]),
  modified: z.array(z.string()).default([]),
  deleted: z.array(z.string()).default([]),
});

export type WorkflowCompilationFileChanges = z.infer<
  typeof workflowCompilationFileChangesSchema
>;

export const workflowCompilationAgentSchema = z.object({
  agentId: z.string().min(1),
  phaseId: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  status: z.string().min(1),
  stuck: z.boolean().optional(),
  durationSeconds: z.number().min(0).optional(),
  escalation: z.string().optional(),
  result: z
    .object({
      summary: z.string().optional(),
      artifacts: z.array(z.string()).default([]),
      changes: z.array(z.string()).default([]),
      notes: z.array(z.string()).default([]),
      branch: z.string().optional(),
    })
    .optional(),
});

export type WorkflowCompilationAgent = z.infer<
  typeof workflowCompilationAgentSchema
>;

export const workflowCompilationStageSchema = z.object({
  name: z.string().min(1),
  durationMs: z.number().int().min(0),
  status: z.string().min(1),
});

export type WorkflowCompilationStage = z.infer<
  typeof workflowCompilationStageSchema
>;

export const workflowCompilationSchema = z.object({
  version: z.literal(workflowCompilationVersion),
  runId: z.string().min(1),
  requirement: z.string(),
  status: z.enum(["completed", "failed"]),
  finishedAt: z.string(),

  // From ExecutionSummary
  totalDurationMs: z.number().int().min(0).optional(),
  stages: z.array(workflowCompilationStageSchema).default([]),
  agentsSpawned: z.number().int().min(0).optional(),
  filesChanged: z.number().int().min(0).optional(),
  learningInsights: z.number().int().min(0).optional(),

  // Human summary from summarize stage output
  summaryText: z.string().optional(),

  // Work compilation payloads
  fileChanges: workflowCompilationFileChangesSchema.default({
    created: [],
    modified: [],
    deleted: [],
  }),
  agents: z.array(workflowCompilationAgentSchema).default([]),

  // Failure details (if any)
  lastStage: z.string().optional(),
  error: z.string().optional(),
});

export type WorkflowCompilation = z.infer<typeof workflowCompilationSchema>;
