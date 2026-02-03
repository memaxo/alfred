import type { WavePlan } from "@alfred/agent/orchestrator/multi/spawn";
import type { StructuredPlan } from "@alfred/plan";
import type { AgentOutcome } from "@alfred/runtime/orchestrator/agent";
// Import actual types from dependencies to avoid type mismatches
import type { SubTask } from "@alfred/type/plan";

import type { KnowledgeInsight, ReviewCheck } from "../events";

// Re-export for convenience
export type { SubTask, AgentOutcome, WavePlan, ReviewCheck };

// File change record
export interface FileChange {
  path: string;
  action: "create" | "modify" | "delete";
  diff?: string;
}

// Chunk from RAG retrieval
export interface Chunk {
  content: string;
  source: string;
  score: number;
}

// ATIF trajectory for observability
export interface ATIFTrajectory {
  runId: string;
  stages: {
    name: string;
    events: { type: string; timestamp: number; data?: unknown }[];
  }[];
}

// Context bundle from runtime
export interface ContextBundle {
  maxTokens: number;
  estimatedTokens: number;
  files: {
    path: string;
    startLine: number;
    endLine: number;
    tokens: number;
    content: string;
  }[];
  links?: {
    url: string;
    title?: string;
    score?: number;
  }[];
  note?: string;
}

// Search receipt
export interface SearchReceipt {
  sources: string[];
  totalResults: number;
}

// --- Stage Output Types ---

export interface PipelineInput {
  runId: string;
  requirement: string;
  workspace: string;
  userId: string;
  authz?: string;
  cognitive?: {
    streamId?: string;
    autonomyLevel?: number;
  };
  linear?: {
    sessionId: string;
    space: string;
    teamId?: string;
    issueId?: string;
    authz: string;
  };
}

export interface InitOutput {
  projectId: string;
  linearProjectId?: string;
  linearIssueId?: string;
}

export interface ContextOutput {
  bundle: ContextBundle;
  receipts: SearchReceipt;
  ragChunks: Chunk[];
  totalTokens: number;
}

export interface PlanOutput {
  planId: string;
  structuredPlan: StructuredPlan;
  subtasks: SubTask[];
  execPlans: Map<string, string>; // subtaskId -> path to .md file
  rootPlanPath: string;
}

export interface ScheduleOutput {
  waves: WavePlan[];
  executionMode: "sequential" | "parallel";
  estimatedDuration: number;
}

export interface ExecuteOutput {
  outcomes: Map<string, AgentOutcome>;
  fileChanges: FileChange[];
  handoffs: string[];
  dryRun?: boolean;
}

export interface ReviewOutput {
  checks: ReviewCheck[];
  allPassed: boolean;
  fixAttempts: number;
}

export interface LearnOutput {
  insights: KnowledgeInsight[];
  mistakes: { type: string; context: string }[];
  graphUpdates: number;
}

export interface SummarizeOutput {
  summary: string;
  trajectory: ATIFTrajectory;
  linearUpdated: boolean;
}

// Pipeline result is the final summarize output
export type PipelineResult = SummarizeOutput;
