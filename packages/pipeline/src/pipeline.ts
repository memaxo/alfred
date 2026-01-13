// Stage name enumeration
export type StageName =
  | "init" // Create project, link Linear
  | "context" // Gather code + web + RAG context
  | "plan" // Decompose requirement into subtasks
  | "schedule" // Decide execution order (sequential/parallel)
  | "execute" // Spawn and run agents
  | "review" // Quality checks, self-correction
  | "learn" // Extract knowledge, update hypergraph
  | "summarize"; // Generate summary, notify consumers

export const STAGE_ORDER: readonly StageName[] = [
  "init",
  "context",
  "plan",
  "schedule",
  "execute",
  "review",
  "learn",
  "summarize",
] as const;

// Pipeline stage interface (generic over input/output types)
export type PipelineStage<TInput, TOutput> = {
  readonly name: StageName;
  execute(input: TInput, ctx: PipelineContext): Promise<TOutput>;
  rollback?(output: TOutput, ctx: PipelineContext): Promise<void>;
};

// Context available to all stages
export type PipelineContext = {
  readonly runId: string;
  readonly requirement: string;
  readonly workspace: string;
  readonly userId: string;
  readonly signal: AbortSignal;
  readonly config: PipelineConfig;
  emit(event: PipelineEvent): void;
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
};

// Configuration for pipeline execution
export type PipelineConfig = {
  maxParallel: number; // 1 for sequential POC
  maxAgentAttempts: number; // Default: 3
  maxReviewAttempts: number; // Default: 3
  enableLearning: boolean;
  enableLinearSync: boolean;
  linearSyncInterval: number; // ms, for batching
  phaseTimeouts: Record<StageName, number>;
};

// Default configuration
export const DEFAULT_CONFIG: PipelineConfig = {
  maxParallel: 1,
  maxAgentAttempts: 3,
  maxReviewAttempts: 3,
  enableLearning: true,
  enableLinearSync: false,
  linearSyncInterval: 30_000,
  phaseTimeouts: {
    init: 30_000,
    context: 120_000,
    plan: 120_000,
    schedule: 10_000,
    execute: 600_000,
    review: 300_000,
    learn: 60_000,
    summarize: 30_000,
  },
};

// Re-export for type resolution
import type { PipelineEvent } from "./events";
export type { PipelineEvent };
