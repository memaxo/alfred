import type { StageName } from "./pipeline";

// Agent execution outcome
export type AgentOutcome = {
  status: "success" | "failure" | "escalated" | "timeout";
  durationMs: number;
  handoff?: string;
  error?: string;
};

// Knowledge insight from learning
export type KnowledgeInsight = {
  type: "heuristic" | "mistake" | "pattern";
  content: string;
  confidence: number;
};

// Review check result
export type ReviewCheck = {
  name: string;
  passed: boolean;
  message?: string;
};

// Execution summary
export type ExecutionSummary = {
  runId: string;
  requirement: string;
  stages: Array<{ name: StageName; durationMs: number; status: string }>;
  totalDurationMs: number;
  agentsSpawned: number;
  filesChanged: number;
  learningInsights: number;
};

// Union of all pipeline events
export type PipelineEvent =
  | { type: "stage:enter"; stage: StageName; timestamp: number }
  | {
      type: "stage:exit";
      stage: StageName;
      durationMs: number;
      timestamp: number;
    }
  | { type: "stage:error"; stage: StageName; error: string; timestamp: number }
  | {
      type: "stage:progress";
      stage: StageName;
      message: string;
      timestamp: number;
    }
  | { type: "agent:spawn"; agentId: string; taskId: string; timestamp: number }
  | {
      type: "agent:progress";
      agentId: string;
      message: string;
      timestamp: number;
    }
  | {
      type: "agent:complete";
      agentId: string;
      outcome: AgentOutcome;
      timestamp: number;
    }
  | { type: "review:check"; check: ReviewCheck; timestamp: number }
  | { type: "learn:insight"; insight: KnowledgeInsight; timestamp: number }
  | { type: "pipeline:complete"; summary: ExecutionSummary; timestamp: number }
  | {
      type: "pipeline:failed";
      error: string;
      lastStage: StageName;
      timestamp: number;
    };

// Helper to create timestamped events
export function createEvent<T extends PipelineEvent["type"]>(
  type: T,
  data: Omit<Extract<PipelineEvent, { type: T }>, "type" | "timestamp">
): Extract<PipelineEvent, { type: T }> {
  return { type, ...data, timestamp: Date.now() } as Extract<
    PipelineEvent,
    { type: T }
  >;
}
