/**
 * Runtime type definitions
 *
 * Pure types for workflow execution runtime.
 * Runtime is a leaf package - no runtime-specific types should leak to other packages.
 */

import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { LanguageModel } from "ai";
import { z } from "zod";
import type { AiAdapter } from "./adapters/ai";

/**
 * Resume payload for in-flight authorization
 */
export type ResumePayload = {
  event:
    | "deploy-authz"
    | "linear-authz"
    | "bio-authz"
    | "mfa-authz"
    | "human-authz";
  authz: string;
};

/**
 * Workflow execution phases
 */
export type WorkflowPhase = "scan" | "plan" | "act" | "report";

/**
 * Phase configuration
 */
export type PhaseConfig = {
  name: WorkflowPhase;
  timeoutMs: number;
};

/**
 * Runtime input matching current RunPlanInput
 */
export type RuntimeInput = {
  requirement: string;
  auto: "read" | "low" | "medium" | "high";
  planId?: string; // New: Optional plan ID for phased execution
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
};

/**
 * Runtime options for dependency injection
 */
export type RuntimeOptions = {
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
};

/**
 * Runtime execution state (transient, in-memory only)
 */
export type RuntimeState = {
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
};

/**
 * Runtime interface (matches current RunPlanV6)
 */
export type WorkflowRuntime = {
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
};

/**
 * Runtime input validation schema
 */
export const runtimeInputSchema = z.object({
  requirement: z.string().min(1, "Requirement must not be empty"),
  auto: z.enum(["read", "low", "medium", "high"]),
  planId: z.string().uuid().optional(),
  workspace: z.string().optional(),
  repoBase: z.string().optional(),
  mode: z.enum(["sequential", "parallel"]).optional(),
  interactive: z.boolean().optional(),
  toolgraph: z
    .object({
      maxParallel: z.number().int().min(1).max(32).optional(),
      backoffMs: z.number().int().min(0).max(10_000).optional(),
    })
    .optional(),
  linear: z
    .object({
      issueId: z.string().min(1).optional(),
      sessionId: z.string().min(1),
      space: z.string().min(1),
      authz: z.string().min(1),
    })
    .optional(),
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
});

/**
 * Runtime options validation schema
 */
export const runtimeOptionsSchema = z.object({
  input: runtimeInputSchema,
  model: z.custom<LanguageModel>((val) => val !== null && val !== undefined, {
    message: "Model must be provided",
  }),
  signal: z.custom<AbortSignal>().optional(),
  runtimeContext: z
    .custom<RuntimeContext<Record<string, unknown>>>()
    .optional(),
  stepTimeoutMs: z
    .number()
    .int()
    .min(1000, "Step timeout must be at least 1 second")
    .optional(),
  workflowTimeoutMs: z
    .number()
    .int()
    .min(1000, "Workflow timeout must be at least 1 second")
    .optional(),
  runId: z.string().uuid().optional(),
  history: z.array(z.custom<WorkflowEvent>()).optional(),
  authz: z.string().optional(),
  supervisorHeartbeatMs: z
    .number()
    .int()
    .min(100, "Supervisor heartbeat must be at least 100ms")
    .optional(),
  supervisorCheckIntervalMs: z
    .number()
    .int()
    .min(10, "Supervisor check interval must be at least 10ms")
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
