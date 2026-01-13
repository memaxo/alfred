import type { KnowledgeInsight, ReviewCheck } from "../events";

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

// Context bundle (simplified interface - actual type from @alfred/runtime)
export type ContextBundle = {
  files?: Array<{ path: string; content: string }>;
  totalTokens: number;
};

// Search receipt (simplified interface)
export type SearchReceipt = {
  sources: string[];
  totalResults: number;
};

// SubTask (from @alfred/type/plan)
export type SubTask = {
  id: string;
  title: string;
  description: string;
  dependsOn: string[];
};

// Wave plan (from @alfred/agent)
export type WavePlan = {
  wave: number;
  agents: string[];
};

// Agent outcome (from @alfred/runtime)
export type AgentOutcome = {
  agentId: string;
  phaseId: string;
  stuck: boolean;
  status: "success" | "failure" | "timeout";
  durationSeconds: number;
  role: string;
  escalation?: string;
  result?: {
    summary?: string;
    changes?: string[];
  };
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
