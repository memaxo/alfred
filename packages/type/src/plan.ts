/**
 * ALFRED Implementation Plan Types
 * Zod schemas for Orchestrator planning workflow
 */

import { z } from "zod";
import type { Obligation, ObligationResumeEvent } from "./policy";

// TODO: [Phase 4] Refine schemas based on actual Orchestrator workflow requirements

/**
 * Task represents a single unit of work
 */
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  assigned: z.string().optional(), // Droid or agent name
  dependencies: z.array(z.string()).default([]), // Task IDs
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  created: z.date().default(() => new Date()),
  started: z.date().optional(),
  completed: z.date().optional(),
  error: z.string().optional(),
});

export type Task = z.infer<typeof taskSchema>;

/**
 * ModulePlan represents work for a single module/file
 */
export const modulePlanSchema = z.object({
  id: z.string(),
  path: z.string(), // File path relative to project root
  description: z.string(),
  tasks: z.array(taskSchema),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  branch: z.string().optional(), // Git branch if using worktrees
  worktree: z.string().optional(), // Worktree path
});

export type ModulePlan = z.infer<typeof modulePlanSchema>;

/**
 * ImplementationPlan is the top-level plan from Orchestrator
 */
export const implementationPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  ticket: z.string().optional(), // Linear ticket ID
  modules: z.array(modulePlanSchema),
  strategy: z.enum(["sequential", "parallel"]).default("sequential"),
  status: z.enum([
    "planning",
    "scheduled",
    "executing",
    "reviewing",
    "completed",
    "failed",
  ]),
  created: z.date().default(() => new Date()),
  started: z.date().optional(),
  completed: z.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;

// TODO: [Phase 4] Add validation helpers
// export function validatePlan(plan: unknown): ImplementationPlan {
//   return implementationPlanSchema.parse(plan);
// }

// TODO: [Phase 4] Add plan transformation utilities
// export function mergePlans(plans: ImplementationPlan[]): ImplementationPlan {
//   // Merge multiple plans into one
// }

export const droidArtifactSchema = z.object({
  path: z.string(),
  kind: z.string(),
});

export type DroidArtifact = z.infer<typeof droidArtifactSchema>;

/**
 * Search receipt item base schema (non-recursive fields)
 */
const searchReceiptItemBaseSchema = z.object({
  id: z.string(),
  kind: z.enum(["code", "web"]),
  // File-related fields (for code kind)
  path: z.string().optional(),
  bytes: z.number().optional(),
  tokens: z.number().optional(),
  // URL-related fields (for web kind)
  url: z.string().optional(),
  title: z.string().optional(),
  score: z.number(),
  reason: z.string().optional(),
  snippet: z.string().optional(),
  publishedDate: z.string().optional(),
  image: z.string().optional(),
  favicon: z.string().optional(),
  // Exa-specific fields
  author: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  highlightScores: z.array(z.number()).optional(),
  summary: z.string().optional(), // AI-generated summary (distinct from snippet)
  links: z.array(z.string()).optional(), // Extracted outbound links
});

/**
 * Search receipt item with recursive subpages support
 */
export const searchReceiptItemSchema: z.ZodType<SearchReceiptItem> =
  searchReceiptItemBaseSchema.extend({
    subpages: z.lazy(() => z.array(searchReceiptItemSchema)).optional(),
  });

/**
 * Search receipt item type
 */
export type SearchReceiptItem = z.infer<typeof searchReceiptItemBaseSchema> & {
  subpages?: SearchReceiptItem[];
};

/**
 * Search receipt schema with Exa metadata
 */
export const searchReceiptSchema = z.object({
  code: z.array(searchReceiptItemSchema),
  web: z.array(searchReceiptItemSchema).optional(),
  created: z.date(),
  summary: z.string().optional(),
  // Exa metadata
  searchType: z.enum(["auto", "neural", "keyword", "fast", "deep"]).optional(),
  context: z.string().optional(), // LLM-optimized combined content
  cost: z
    .object({
      total: z.number(),
      search: z.number().optional(),
      contents: z.number().optional(),
    })
    .optional(),
});

export type SearchReceipt = z.infer<typeof searchReceiptSchema>;

export const contextFileSliceSchema = z.object({
  path: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  tokens: z.number(),
  content: z.string(),
});

export type ContextFileSlice = z.infer<typeof contextFileSliceSchema>;

export const contextBundleSchema = z.object({
  maxTokens: z.number(),
  estimatedTokens: z.number(),
  files: z.array(contextFileSliceSchema),
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

export type ContextBundle = z.infer<typeof contextBundleSchema>;

export const planReportFindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string().optional(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  status: z.enum(["open", "resolved", "deferred"]),
  module: z.string().optional(),
  taskId: z.string().optional(),
});

export type PlanReportFinding = z.infer<typeof planReportFindingSchema>;

export const planReportRiskSchema = z.object({
  id: z.string(),
  detail: z.string(),
  impact: z.enum(["low", "medium", "high"]),
  likelihood: z.enum(["low", "medium", "high"]),
  mitigation: z.string().optional(),
  module: z.string().optional(),
  taskId: z.string().optional(),
});

export type PlanReportRisk = z.infer<typeof planReportRiskSchema>;

export const planReportChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["pending", "done", "skipped"]),
  module: z.string().optional(),
  taskId: z.string().optional(),
});

export type PlanReportChecklistItem = z.infer<
  typeof planReportChecklistItemSchema
>;

export const planReportModuleSchema = z.object({
  id: z.string(),
  path: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  summary: z.string().optional(),
});

export type PlanReportModule = z.infer<typeof planReportModuleSchema>;

export const planReportRunSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  resourceId: z.string().optional(),
  url: z.string().url().optional(),
});

export type PlanReportRun = z.infer<typeof planReportRunSchema>;

export const planReportContextSchema = z.object({
  receipts: searchReceiptSchema.or(z.unknown()).optional(),
  bundle: contextBundleSchema.optional(),
});

export type PlanReportContext = z.infer<typeof planReportContextSchema>;

export const planReportSchema = z.object({
  id: z.string(),
  planId: z.string(),
  createdAt: z.string(),
  summary: z.string(),
  findings: z.array(planReportFindingSchema),
  risks: z.array(planReportRiskSchema),
  modules: z.array(planReportModuleSchema),
  checklist: z.array(planReportChecklistItemSchema),
  outcome: z.object({
    completed: z.number().min(0),
    failed: z.number().min(0),
    total: z.number().min(0),
  }),
  context: planReportContextSchema.optional(),
  run: planReportRunSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PlanReport = z.infer<typeof planReportSchema>;

export const codexReportFindingSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  detail: z.string().optional(),
  impact: z.enum(["low", "medium", "high"]).optional(),
  scope: z.string().optional(),
});

export const codexReportRiskSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  mitigation: z.string().optional(),
  likelihood: z.enum(["low", "medium", "high"]).optional(),
  impact: z.enum(["low", "medium", "high"]).optional(),
});

export const codexReportHotspotSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  reason: z.string().min(1),
  score: z.number().min(0).max(1).optional(),
});

export const codexReportTimeBreakdownSchema = z.object({
  phase: z.string().min(1),
  hours: z.number().min(0),
});

export const codexReportTimeSchema = z.object({
  estimateHours: z.number().min(0),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  breakdown: z.array(codexReportTimeBreakdownSchema).default([]),
  updated: z.string().datetime().optional(),
});

export const codexReportSchema = z.object({
  findings: z.array(codexReportFindingSchema).default([]),
  risks: z.array(codexReportRiskSchema).default([]),
  hotspots: z.array(codexReportHotspotSchema).default([]),
  time: codexReportTimeSchema,
});

export type CodexReport = z.infer<typeof codexReportSchema>;

export const codexPlanTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  owner: z.string().optional(),
  estimateHours: z.number().min(0).optional(),
  kind: z
    .enum(["analysis", "implementation", "validation", "followup"])
    .optional(),
  dependencies: z.array(z.string().min(1)).default([]),
  deliverables: z.array(z.string().min(1)).default([]),
});

export const codexPlanAcceptanceSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["test", "review", "analysis", "deployment"]).optional(),
  owner: z.string().optional(),
});

export const codexPlanBranchStrategySchema = z.object({
  base: z.string().min(1),
  feature: z.string().min(1),
  review: z.string().optional(),
  notes: z.string().optional(),
});

export const codexPlanDepsSchema = z
  .array(z.tuple([z.string().min(1), z.string().min(1)]))
  .default([]);

export const codexPlanSchema = z.object({
  tasks: z.array(codexPlanTaskSchema).default([]),
  deps: codexPlanDepsSchema,
  acceptanceChecks: z.array(codexPlanAcceptanceSchema).default([]),
  branchStrategy: codexPlanBranchStrategySchema,
});

export type CodexPlanArtifact = z.infer<typeof codexPlanSchema>;

export type SubTaskId = string;

// NodeId type for plan types (matches @alfred/knowledge/hypergraph)
export type NodeId = string & { readonly _: unique symbol };

export type SubTask = {
  id: SubTaskId;
  title: string;
  requirement: string;
  deps: SubTaskId[];
  priority: number;
  acceptance: string[];
  filesHint: string[];
  metadata?: Record<string, unknown>;
};

export type DecomposeContext = {
  requirement: string;
  bundle: ContextBundle | null;
};

export type WavePlan = {
  id: string;
  agents: string[];
  dependsOn: string[];
  agentType?: string;
  isolation?: "container" | "worktree";
  phaseId?: string;
};

type WorkflowEventBase = {
  /** Optional stable identity for deduplication during replay */
  eventId?: string;
};

export type WorkflowEvent =
  | (WorkflowEventBase & { type: "progress"; pct?: number; message?: string })
  | (WorkflowEventBase & { type: "stdout"; text: string })
  | (WorkflowEventBase & { type: "stderr"; text: string })
  | (WorkflowEventBase & { type: "droid"; chunk: unknown })
  | (WorkflowEventBase & { type: "notice"; message: string })
  | (WorkflowEventBase & {
      type: "obligation";
      runId: string;
      obligations: Obligation[];
      resumeEvents?: ObligationResumeEvent[];
    })
  | (WorkflowEventBase & {
      type: "data-cache-handoff";
      receipts?: SearchReceipt;
    })
  | (WorkflowEventBase & {
      type: "context";
      phase: "scan" | "web" | "bundle";
      message?: string;
      receipts?: SearchReceipt;
      bundle?: ContextBundle;
    })
  | (WorkflowEventBase & { type: "plan-selected"; plan: unknown })
  | (WorkflowEventBase & {
      type: "phase-start";
      phaseId: string;
      phase: unknown;
    })
  | (WorkflowEventBase & {
      type: "phase-complete";
      phaseId: string;
      result: unknown;
    })
  | (WorkflowEventBase & {
      type: "phase-progress";
      phaseId: string;
      progress: number;
    })
  | (WorkflowEventBase & {
      type: "agent-start";
      agentId: string;
      phaseId: string;
    })
  | (WorkflowEventBase & {
      type: "agent-complete";
      agentId: string;
      phaseId: string;
      result: unknown;
    })
  | (WorkflowEventBase & { type: "wave-start"; waveId: string })
  | (WorkflowEventBase & { type: "wave-complete"; waveId: string })
  | (WorkflowEventBase & { type: "agent-handoff"; data: unknown })
  | (WorkflowEventBase & { type: string; [key: string]: unknown });
