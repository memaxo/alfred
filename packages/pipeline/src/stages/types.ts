import type { KnowledgeInsight, ReviewCheck } from "../events";

// Import actual types from dependencies to avoid type mismatches
import type { SubTask } from "@alfred/type/plan";
import type { AgentOutcome } from "@alfred/runtime/orchestrator/agent";
import type { WavePlan } from "@alfred/agent/orchestrator/multi/spawn";

// Re-export for convenience
export type { SubTask, AgentOutcome, WavePlan, ReviewCheck };

// File change record
export type FileChange = {
  path: string;
  action: "create" | "modify" | "delete";
  diff?: string;
};

// Chunk from RAG retrieval
export type Chunk = {
  content: string;
  source: string;
  score: number;
};

// ATIF trajectory for observability
export type ATIFTrajectory = {
  runId: string;
  stages: Array<{
    name: string;
    events: Array<{ type: string; timestamp: number; data?: unknown }>;
  }>;
};

// Context bundle from runtime
export type ContextBundle = {
  maxTokens: number;
  estimatedTokens: number;
  files: Array<{
    path: string;
    startLine: number;
    endLine: number;
    tokens: number;
    content: string;
  }>;
  links?: Array<{
    url: string;
    title?: string;
    score?: number;
  }>;
  note?: string;
};

// Search receipt
export type SearchReceipt = {
  sources: string[];
  totalResults: number;
};

// --- Stage Output Types ---

export type PipelineInput = {
  runId: string;
  requirement: string;
  workspace: string;
  userId: string;
  linear?: {
    sessionId: string;
    space: string;
    issueId?: string;
    authz: string;
  };
};

export type InitOutput = {
  projectId: string;
  linearProjectId?: string;
  linearIssueId?: string;
};

export type ContextOutput = {
  bundle: ContextBundle;
  receipts: SearchReceipt;
  ragChunks: Chunk[];
  totalTokens: number;
};

export type PlanOutput = {
  subtasks: SubTask[];
  execPlans: Map<string, string>; // subtaskId -> path to .md file
  rootPlanPath: string;
};

export type ScheduleOutput = {
  waves: WavePlan[];
  executionMode: "sequential" | "parallel";
  estimatedDuration: number;
};

export type ExecuteOutput = {
  outcomes: Map<string, AgentOutcome>;
  fileChanges: FileChange[];
  handoffs: string[];
};

export type ReviewOutput = {
  checks: ReviewCheck[];
  allPassed: boolean;
  fixAttempts: number;
};

export type LearnOutput = {
  insights: KnowledgeInsight[];
  mistakes: Array<{ type: string; context: string }>;
  graphUpdates: number;
};

export type SummarizeOutput = {
  summary: string;
  trajectory: ATIFTrajectory;
  linearUpdated: boolean;
};

// Pipeline result is the final summarize output
export type PipelineResult = SummarizeOutput;
