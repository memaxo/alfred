/**
 * Runtime type definitions
 *
 * Pure types for workflow execution runtime.
 * Runtime is a leaf package - no runtime-specific types should leak to other packages.
 */

import { type WorkflowEvent } from "@alfred/type/plan";
import { type RuntimeContext } from "@alfred/type/runtime-context";
import { type LanguageModel } from "ai";
import { z } from "zod";

import { type AiAdapter } from "./adapters/ai";

/**
 * Resume payload for in-flight authorization
 */
export interface ResumePayload {
  event:
    | "deploy-authz"
    | "linear-authz"
    | "bio-authz"
    | "mfa-authz"
    | "human-authz";
  authz: string;
}

/**
 * Workflow execution phases
 */
export type WorkflowPhase = "scan" | "plan" | "act" | "report";

/**
 * Phase configuration
 */
export interface PhaseConfig {
  name: WorkflowPhase;
  timeoutMs: number;
}

/**
 * Runtime input matching current RunPlanInput
 */
export interface RuntimeInput {
  requirement: string;
  auto: "read" | "low" | "medium" | "high";
  planId?: string; // New: Optional plan ID for phased execution
  /** Optional base runId to clone AgentFS DB from (run-to-run sharing). */
  agentfsBaseRunId?: string;
  workspace?: string;
  repoBase?: string;
  mode?: "sequential" | "parallel";
  interactive?: boolean; // Phase 12: Interactive Mode
  toolgraph?: {
    maxParallel?: number;
    backoffMs?: number;
  };
  linear?: {
    issueId?: string;
    sessionId: string;
    space: string;
    authz: string;
  };
  context?: {
    enable?: boolean;
    web?: boolean;
    topK?: number;
    maxTokens?: number;
    exts?: string[];
    ignore?: string[];
    seeds?: string[];
  };
}

/**
 * Runtime options for dependency injection
 */
export interface RuntimeOptions {
  /** Input parameters */
  input: RuntimeInput;

  /** AI model to use for planning */
  model: LanguageModel;

  /** Cancellation signal */
  signal?: AbortSignal;

  /** Shared RuntimeContext instance (optional) */
  runtimeContext?: RuntimeContext<Record<string, unknown>>;

  /** Step timeout in milliseconds (default: 5 minutes) */
  stepTimeoutMs?: number;

  /** Workflow timeout in milliseconds (default: 30 minutes) */
  workflowTimeoutMs?: number;

  /** Override run ID (e.g. for hydration) */
  runId?: string;

  /** Event history for hydration */
  history?: WorkflowEvent[];

  /** Authorization token for tool execution */
  authz?: string;

  /**
   * Optional AI adapter factory (primarily for deterministic tests).
   * When omitted, phases construct `AISDKAdapter` directly.
   */
  createAiAdapter?: (runId: string) => AiAdapter;

  /** Expected heartbeat frequency for supervisor interrupts (default: 60s) */
  supervisorHeartbeatMs?: number;

  /** Polling interval for supervisor physiology checks (default: 1s) */
  supervisorCheckIntervalMs?: number;
}

/**
 * Runtime execution state (transient, in-memory only)
 */
export interface RuntimeState {
  /** Unique run identifier */
  runId: string;

  /** Current execution phase */
  phase: WorkflowPhase | null;

  /** Cancellation flag */
  cancelled: boolean;

  /** Resume promise resolver */
  resumeResolver: ((payload: ResumePayload | null) => void) | null;

  /** Queued resume payloads */
  resumeQueue: ResumePayload[];

  /** Resume timeout handle for cleanup */
  resumeTimeout: NodeJS.Timeout | null;

  /** Final workflow status */
  finalStatus: "completed" | "failed" | "cancelled" | "suspended" | null;

  /** Final error message if failed */
  finalMessage: string | null;
}

/**
 * Runtime interface (matches current RunPlanV6)
 */
export interface WorkflowRuntime {
  /** Unique run identifier */
  runId: string;

  /** Human-readable summary */
  summary: string;

  /** Event stream for consumption */
  stream: AsyncGenerator<WorkflowEvent, void, void>;

  /** Resume with authorization */
  resume(payload: ResumePayload): Promise<void>;

  /** Cancel execution */
  cancel(): void;
}

/**
 * Runtime input validation schema
 */
export const runtimeInputSchema = z.object({
  agentfsBaseRunId: z.string().min(1).optional(),
  auto: z.enum(["read", "low", "medium", "high"]),
  context: z
    .object({
      enable: z.boolean().optional(),
      web: z.boolean().optional(),
      topK: z.number().int().min(1).max(100).optional(),
      maxTokens: z.number().int().min(2000).max(200_000).optional(),
      exts: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
      seeds: z.array(z.string()).optional(),
    })
    .optional(),
  interactive: z.boolean().optional(),
  linear: z
    .object({
      issueId: z.string().min(1).optional(),
      sessionId: z.string().min(1),
      space: z.string().min(1),
      authz: z.string().min(1),
    })
    .optional(),
  mode: z.enum(["sequential", "parallel"]).optional(),
  planId: z.string().uuid().optional(),
  repoBase: z.string().optional(),
  requirement: z.string().min(1, "Requirement must not be empty"),
  toolgraph: z
    .object({
      maxParallel: z.number().int().min(1).max(32).optional(),
      backoffMs: z.number().int().min(0).max(10_000).optional(),
    })
    .optional(),
  workspace: z.string().optional(),
});

/**
 * Runtime options validation schema
 */
export const runtimeOptionsSchema = z.object({
  authz: z.string().optional(),
  history: z.array(z.custom<WorkflowEvent>()).optional(),
  input: runtimeInputSchema,
  model: z.custom<LanguageModel>((val) => val !== null && val !== undefined, {
    message: "Model must be provided",
  }),
  runId: z.string().uuid().optional(),
  runtimeContext: z
    .custom<RuntimeContext<Record<string, unknown>>>()
    .optional(),
  signal: z.custom<AbortSignal>().optional(),
  stepTimeoutMs: z
    .number()
    .int()
    .min(1000, "Step timeout must be at least 1 second")
    .optional(),
  supervisorCheckIntervalMs: z
    .number()
    .int()
    .min(10, "Supervisor check interval must be at least 10ms")
    .optional(),
  supervisorHeartbeatMs: z
    .number()
    .int()
    .min(100, "Supervisor heartbeat must be at least 100ms")
    .optional(),
  workflowTimeoutMs: z
    .number()
    .int()
    .min(1000, "Workflow timeout must be at least 1 second")
    .optional(),
});

/**
 * Validate runtime options
 *
 * Throws ZodError with details if validation fails
 */
export function validateRuntimeOptions(options: unknown): RuntimeOptions {
  return runtimeOptionsSchema.parse(options);
}
