/**
 * Zod schemas for Pipeline Phase APIs
 *
 * These schemas validate inputs and outputs for phase-level API endpoints,
 * enabling plan preview, human-in-the-loop review, and staged execution.
 */

import { z } from "zod";

// --- Base Schemas ---

/**
 * Linear integration input schema
 */
export const linearInputSchema = z.object({
  space: z.string().min(1),
  teamId: z.string().optional(),
  sessionId: z.string().optional(),
  issueId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  issueUrl: z.string().optional(),
});

/**
 * SubTask schema - a single unit of work
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
 * WavePlan schema - a group of agents that can execute concurrently
 */
export const wavePlanSchema = z.object({
  id: z.string(),
  agents: z.array(z.string()),
  dependsOn: z.array(z.string()),
  agentType: z.string().optional(),
  isolation: z.enum(["agentfs"]).optional(),
  phaseId: z.string().optional(),
});

/**
 * Pipeline snapshot schema (simplified for API responses)
 */
export const pipelineSnapshotSchema = z.object({
  runId: z.string(),
  status: z.enum(["idle", "running", "suspended", "completed", "failed"]),
  requirement: z.string(),
  lastCompletedStage: z
    .enum([
      "init",
      "context",
      "plan",
      "schedule",
      "execute",
      "review",
      "learn",
      "summarize",
    ])
    .nullable(),
  lastCompletedStageIndex: z.number(),
  startedAt: z.number(),
  lastEventAt: z.number(),
  error: z.string().nullable(),
});

// --- Phase Input Schemas ---

/**
 * Input for the plan phase (init → context → plan → schedule)
 */
export const planPhaseInputSchema = z.object({
  /** Optional run ID (generated if not provided) */
  runId: z.string().optional(),
  /** The requirement/task description */
  requirement: z.string().min(1),
  /** Workspace/repository path */
  workspace: z.string().min(1),
  /** User ID for authorization */
  userId: z.string().min(1),
  /** Optional authorization token */
  authz: z.string().optional(),
  /** Optional Linear integration config */
  linear: linearInputSchema.optional(),
  /** Optional Linear authorization token */
  authzLinear: z.string().optional(),
});

/**
 * Input for the execute phase (execute → review → learn → summarize)
 */
export const executePhaseInputSchema = z.object({
  /** Run ID from plan phase */
  runId: z.string().min(1),
  /** Wave plans from plan phase */
  waves: z.array(wavePlanSchema),
  /** Subtasks from plan phase */
  subtasks: z.array(subTaskSchema),
  /** Exec plan file paths keyed by subtask ID */
  execPlans: z.record(z.string(), z.string()),
  /** Root plan file path */
  rootPlanPath: z.string(),
  /** Workspace path */
  workspace: z.string().min(1),
  /** User ID */
  userId: z.string().min(1),
  /** Optional authorization token */
  authz: z.string().optional(),
  /** Optional Linear integration config */
  linear: linearInputSchema.optional(),
  /** Optional Linear authorization token */
  authzLinear: z.string().optional(),
});

// --- Phase Output Schemas ---

/**
 * Context bundle schema (from context stage)
 */
export const contextBundleSchema = z.object({
  maxTokens: z.number(),
  estimatedTokens: z.number(),
  files: z.array(
    z.object({
      path: z.string(),
      startLine: z.number(),
      endLine: z.number(),
      tokens: z.number(),
      content: z.string(),
    })
  ),
  links: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        score: z.number().optional(),
      })
    )
    .optional(),
  note: z.string().optional(),
});

/**
 * Output from the plan phase
 */
export const planPhaseOutputSchema = z.object({
  /** Run ID for this pipeline execution */
  runId: z.string(),
  /** Generated wave plans */
  waves: z.array(wavePlanSchema),
  /** Number of waves */
  waveCount: z.number(),
  /** Decomposed subtasks */
  subtasks: z.array(subTaskSchema),
  /** Exec plan file paths keyed by subtask ID */
  execPlans: z.record(z.string(), z.string()),
  /** Root plan file path */
  rootPlanPath: z.string(),
  /** Execution mode */
  executionMode: z.enum(["sequential", "parallel"]),
  /** Estimated duration in milliseconds */
  estimatedDuration: z.number(),
  /** Pipeline snapshot for resume/execute */
  snapshot: pipelineSnapshotSchema,
  /** Context information (optional, for debugging) */
  context: z
    .object({
      totalTokens: z.number(),
      ragChunkCount: z.number(),
    })
    .optional(),
});

/**
 * Phase status response
 */
export const phaseStatusSchema = z.object({
  /** Run ID */
  runId: z.string(),
  /** Current status */
  status: z.enum(["idle", "running", "suspended", "completed", "failed"]),
  /** Last completed stage */
  lastCompletedStage: z
    .enum([
      "init",
      "context",
      "plan",
      "schedule",
      "execute",
      "review",
      "learn",
      "summarize",
    ])
    .nullable(),
  /** Stage index (0-based) */
  lastCompletedStageIndex: z.number(),
  /** Stage results with timing */
  stageResults: z.array(
    z.object({
      name: z.string(),
      durationMs: z.number(),
      status: z.enum(["success", "failure", "skipped"]),
    })
  ),
  /** Error message if failed */
  error: z.string().nullable(),
  /** Can resume from this state */
  canResume: z.boolean(),
  /** Next stage to execute */
  nextStage: z
    .enum([
      "init",
      "context",
      "plan",
      "schedule",
      "execute",
      "review",
      "learn",
      "summarize",
    ])
    .nullable(),
});

// --- Type Exports ---

export type LinearInput = z.infer<typeof linearInputSchema>;
export type SubTask = z.infer<typeof subTaskSchema>;
export type WavePlan = z.infer<typeof wavePlanSchema>;
export type PipelineSnapshotInfo = z.infer<typeof pipelineSnapshotSchema>;
export type PlanPhaseInput = z.infer<typeof planPhaseInputSchema>;
export type ExecutePhaseInput = z.infer<typeof executePhaseInputSchema>;
export type ContextBundle = z.infer<typeof contextBundleSchema>;
export type PlanPhaseOutput = z.infer<typeof planPhaseOutputSchema>;
export type PhaseStatus = z.infer<typeof phaseStatusSchema>;
