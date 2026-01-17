import { z } from "zod";

/**
 * Zod schema for SearchReceipt
 */
export const searchReceiptSchema = z.object({
  query: z.string(),
  results: z.array(z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Zod schema for ContextBundle
 */
export const contextBundleSchema = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Zod schema for WorkflowEvent
 */
export const workflowEventSchema = z.discriminatedUnion("_", [
  z.object({
    _: z.literal("progress"),
    pct: z.number().optional(),
    message: z.string().optional(),
    phase: z.string().optional(),
  }),
  z.object({ _: z.literal("stdout"), text: z.string() }),
  z.object({ _: z.literal("stderr"), text: z.string() }),
  z.object({ _: z.literal("droid"), chunk: z.unknown() }),
  z.object({ _: z.literal("notice"), message: z.string() }),
  z.object({
    _: z.literal("error"),
    message: z.string(),
    chunk: z.unknown().optional(),
    phase: z.string().optional(),
  }),
  z.object({
    _: z.literal("obligation"),
    runId: z.string(),
    obligations: z.array(z.unknown()),
    resumeEvents: z.array(z.unknown()).optional(),
  }),
  z.object({
    _: z.literal("data-cache-handoff"),
    receipts: searchReceiptSchema.optional(),
  }),
  z.object({
    _: z.literal("context"),
    phase: z.enum(["scan", "web", "bundle"]),
    message: z.string().optional(),
    receipts: searchReceiptSchema.optional(),
    bundle: contextBundleSchema.optional(),
  }),
  z.object({ _: z.literal("plan-selected"), plan: z.unknown() }),
  z.object({
    _: z.literal("phase-start"),
    phaseId: z.string(),
    phase: z.unknown(),
  }),
  z.object({
    _: z.literal("phase-complete"),
    phaseId: z.string(),
    result: z.unknown(),
  }),
  z.object({
    _: z.literal("phase-progress"),
    phaseId: z.string(),
    progress: z.number(),
  }),
  z.object({
    _: z.literal("agent-start"),
    agentId: z.string(),
    phaseId: z.string(),
    taskId: z.string().optional(),
  }),
  z.object({
    _: z.literal("agent-complete"),
    agentId: z.string(),
    phaseId: z.string(),
    result: z.unknown().optional(),
    status: z.string().optional(),
    durationMs: z.number().optional(),
  }),
  z.object({ _: z.literal("wave-start"), waveId: z.string() }),
  z.object({ _: z.literal("wave-complete"), waveId: z.string() }),
  z.object({ _: z.literal("agent-handoff"), data: z.unknown() }),
  z.object({ _: z.literal("suspend") }),
  z.object({ _: z.literal("resume") }),
  z.object({
    _: z.literal("workflow-complete"),
    runId: z.string().optional(),
    summary: z.unknown().optional(),
  }),
  z.object({ _: z.literal("run"), id: z.string().optional() }),
]);

/**
 * Zod schema for WorkflowState
 */
export const workflowStateSchema = z.object({
  status: z.enum([
    "idle",
    "running",
    "suspended",
    "completed",
    "failed",
    "cancelled",
  ]),
  progress: z.number(),
  currentPhaseId: z.string().optional(),
  currentAgentId: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  phases: z.record(
    z.string(),
    z.object({
      status: z.enum(["pending", "running", "completed", "failed"]),
      progress: z.number(),
      result: z.unknown().optional(),
    })
  ),
  agents: z.record(
    z.string(),
    z.object({
      status: z.enum(["pending", "running", "completed", "failed"]),
      result: z.unknown().optional(),
    })
  ),
});
