/**
 * Task Enrichment Types
 *
 * Types for the closed-loop learning system where executor run outcomes
 * (failures, fixes, patterns) enrich subsequent executor runs.
 */

import { z } from "zod";

import {
  delightSignalSchema,
  frictionSignalSchema,
  signalInterventionSchema,
} from "./signals";

const enrichBaseSchema = z.object({
  schemaVersion: z.number().int().default(1),
  createdAt: z
    .number()
    .int()
    .default(() => Date.now()),
});

export const enrichCaps = {
  errMsg: 2000,
  errParam: 5000,
  summary: 6000,
  decision: 600,
  rationale: 1200,
  blocker: 400,
  question: 400,
  avoidReason: 300,
  delta: 6000,
  liveErr: 2000,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FailureContext: Unified aggregation of all failure signals
// ─────────────────────────────────────────────────────────────────────────────

export const toolErrorSchema = z.object({
  count: z.number(),
  error: z.string(),
  lastOccurrence: z.number(),
  parameters: z.unknown().optional(),
  tool: z.string(),
});

export type ToolError = z.infer<typeof toolErrorSchema>;

export const loopDetectionSchema = z.object({
  content: z.string().optional(),
  layer: z.number(),
  reason: z.string(),
  ts: z.number(),
});

export type LoopDetection = z.infer<typeof loopDetectionSchema>;

export const reviewFailureSchema = z.object({
  check: z.string(),
  evidence: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
});

export type ReviewFailure = z.infer<typeof reviewFailureSchema>;

export const escalationRecordSchema = z.object({
  details: z.string(),
  reason: z.string(),
  severity: z.enum(["warning", "blocking"]),
  ts: z.number(),
});

export type EscalationRecord = z.infer<typeof escalationRecordSchema>;

export const failureContextSchema = enrichBaseSchema.extend({
  durationMs: z.number(),
  escalations: z.array(escalationRecordSchema),
  loopDetections: z.array(loopDetectionSchema),
  /** LLM-judged friction/delight signals (abstract, no raw content). */
  signals: z.array(frictionSignalSchema).default([]),
  delight: z.array(delightSignalSchema).default([]),
  interventions: z.array(signalInterventionSchema).default([]),
  reviewFailures: z.array(reviewFailureSchema),
  runId: z.string(),
  status: z.enum(["failure", "stuck", "escalated", "timeout"]),
  stuckReason: z.string().optional(),
  taskId: z.string(),
  toolErrors: z.array(toolErrorSchema),
  ts: z.number(),
});

export type FailureContext = z.infer<typeof failureContextSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// StructuredHandoff: Rich wave-to-wave context
// ─────────────────────────────────────────────────────────────────────────────

export const decisionRecordSchema = z.object({
  confidence: z.enum(["low", "medium", "high"]).optional(),
  decision: z.string(),
  rationale: z.string(),
});

export type DecisionRecord = z.infer<typeof decisionRecordSchema>;

export const toolAvoidanceSchema = z.object({
  reason: z.string(),
  tool: z.string(),
});

export type ToolAvoidance = z.infer<typeof toolAvoidanceSchema>;

export const structuredHandoffSchema = enrichBaseSchema.extend({
  blockers: z.array(z.string()),
  decisions: z.array(decisionRecordSchema),
  filesCreated: z.array(z.string()),

  filesDeleted: z.array(z.string()),
  filesModified: z.array(z.string()),
  fromTaskIds: z.array(z.string()),

  fromWaveId: z.string(),
  openQuestions: z.array(z.string()),

  summary: z.string(),
  /** LLM-judged signals observed in prior wave(s). */
  signals: z.array(frictionSignalSchema).default([]),
  delight: z.array(delightSignalSchema).default([]),
  interventions: z.array(signalInterventionSchema).default([]),
  toolsAvoided: z.array(toolAvoidanceSchema),

  ts: z.number(),
});

export type StructuredHandoff = z.infer<typeof structuredHandoffSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// RetryResolution: Links failure to successful fix
// ─────────────────────────────────────────────────────────────────────────────

export const successContextSchema = z.object({
  durationMs: z.number(),
  exitCode: z.number().optional(),
  filesChanged: z.array(z.string()),
  toolsUsed: z.array(z.string()),
});

export type SuccessContext = z.infer<typeof successContextSchema>;

export const retryResolutionSchema = enrichBaseSchema.extend({
  attempt: z.number(),
  delta: z.string(),
  failureContext: failureContextSchema,

  runId: z.string(),
  successContext: successContextSchema,

  taskId: z.string(),
  ts: z.number(),
});

export type RetryResolution = z.infer<typeof retryResolutionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// TaskEnrichment: What gets injected into new tasks
// ─────────────────────────────────────────────────────────────────────────────

export const similarExecutionSchema = z.object({
  runId: z.string(),
  similarity: z.number(),
  status: z.string(),
  summary: z.string(),
  taskId: z.string(),
});

export type SimilarExecution = z.infer<typeof similarExecutionSchema>;

export const relevantHeuristicSchema = z.object({
  domain: z.string(),
  rule: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  sourceRunId: z.string().optional(),
  sourceTaskId: z.string().optional(),
});

export type RelevantHeuristic = z.infer<typeof relevantHeuristicSchema>;

export const upstreamFailureSchema = z.object({
  summary: z.string(),
  taskId: z.string(),
  toolsToAvoid: z.array(z.string()),
});

export type UpstreamFailure = z.infer<typeof upstreamFailureSchema>;

export const taskEnrichmentSchema = enrichBaseSchema.extend({
  handoffContext: structuredHandoffSchema.optional(),

  relevantHeuristics: z.array(relevantHeuristicSchema).max(10),
  similarExecutions: z.array(similarExecutionSchema).max(5),
  taskId: z.string(),

  ts: z.number(),

  upstreamFailures: z.array(upstreamFailureSchema),
});

export type TaskEnrichment = z.infer<typeof taskEnrichmentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// LiveError: Streaming error for sibling agent awareness
// ─────────────────────────────────────────────────────────────────────────────

export const liveErrorSchema = enrichBaseSchema.extend({
  agentId: z.string().optional(),
  error: z.string(),
  parameters: z.unknown().optional(),
  taskId: z.string().optional(),
  tool: z.string(),
  ts: z.number(),
});

export type LiveError = z.infer<typeof liveErrorSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// EnrichmentMetadata: Attached to enriched tasks
// ─────────────────────────────────────────────────────────────────────────────

export const enrichmentMetadataSchema = z.object({
  enrichedAt: z.number(),
  enrichmentSources: z.object({
    hasHandoff: z.boolean(),
    heuristics: z.number(),
    similarExecutions: z.number(),
    upstreamFailures: z.number(),
  }),
});

export type EnrichmentMetadata = z.infer<typeof enrichmentMetadataSchema>;
