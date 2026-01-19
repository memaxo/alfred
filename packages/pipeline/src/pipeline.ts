import type { StuckDetectionConfig } from "@alfred/agent/orchestrator/multi/tracker";

// Re-export for consumers who import from pipeline
export type { StuckDetectionConfig };

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

/**
 * Agent retry configuration.
 */
export type RetryConfig = {
  /** Maximum attempts per agent (default: 1 = no retries) */
  maxAgentAttempts?: number;
  /** Statuses that trigger retry */
  retryableStatuses?: Array<"failure" | "stuck" | "timeout">;
  /** Base backoff in milliseconds (default: 1000) */
  backoffMs?: number;
};

/**
 * Wave abort configuration.
 */
export type WaveAbortConfig = {
  /** Failure rate threshold per wave (default: 0.5) */
  waveFailureThreshold?: number;
  /** Overall failure rate threshold (default: 0.3) */
  overallFailureThreshold?: number;
};

/**
 * Context caching configuration.
 */
export type ContextCachingConfig = {
  /** Enable context caching */
  enabled?: boolean;
  /** Cache TTL in milliseconds (default: 300000 = 5 min) */
  ttlMs?: number;
};

/**
 * Review fixer configuration.
 */
export type ReviewFixerConfig = {
  /** Enable automatic fix attempts on review failure */
  enabled?: boolean;
  /** Maximum fix attempts (default: 3) */
  maxAttempts?: number;
};

// Configuration for pipeline execution
export type PipelineConfig = {
  /** Max parallel agents per wave (1 for sequential) */
  maxParallel: number;
  /** Max agent attempts (deprecated, use retries.maxAgentAttempts) */
  maxAgentAttempts: number;
  /** Max review attempts (deprecated, use reviewFixer.maxAttempts) */
  maxReviewAttempts: number;
  /** Maximum total pipeline events before abort */
  maxTransitions: number;
  /** Enable learning stage */
  enableLearning: boolean;
  /** Enable Linear synchronization */
  enableLinearSync: boolean;
  /** Linear sync interval in ms */
  linearSyncInterval: number;
  /** Per-stage timeouts */
  phaseTimeouts: Record<StageName, number>;
  /** Stuck detection configuration */
  stuckDetection?: StuckDetectionConfig;
  /** Agent retry configuration */
  retries?: RetryConfig;
  /** Wave abort configuration */
  waveAbort?: WaveAbortConfig;
  /** Context caching configuration */
  contextCaching?: ContextCachingConfig;
  /** Review fixer configuration */
  reviewFixer?: ReviewFixerConfig;
};

// Default configuration
export const DEFAULT_CONFIG: PipelineConfig = {
  maxParallel: 1,
  maxAgentAttempts: 3,
  maxReviewAttempts: 3,
  maxTransitions: 50_000,
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
  stuckDetection: {
    noProgressMs: 60_000,
    maxTransitions: 200,
    similarityThreshold: 0.92,
  },
  retries: {
    maxAgentAttempts: 1,
    retryableStatuses: [],
    backoffMs: 1000,
  },
  waveAbort: {
    waveFailureThreshold: 0.4,
    overallFailureThreshold: 0.25,
  },
  contextCaching: {
    enabled: false,
    ttlMs: 300_000,
  },
  reviewFixer: {
    enabled: false,
    maxAttempts: 3,
  },
};

// Re-export for type resolution
import type { PipelineEvent } from "./events";
export type { PipelineEvent };
