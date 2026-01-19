/**
 * Harbor evaluation types
 */

/**
 * ATIF types (mirrored from @alfred/runtime/trajectory/atif to avoid import issues)
 */
export type AtifSource = "user" | "agent" | "system";

export type AtifToolCall = {
  tool_call_id: string;
  function_name: string;
  arguments: unknown;
};

export type AtifObservationResult = {
  source_call_id: string;
  content: unknown;
};

export type AtifStep = {
  step_id: number;
  timestamp: string;
  source: AtifSource;
  message?: string;
  reasoning_content?: string;
  tool_calls?: AtifToolCall[];
  observation?: { results: AtifObservationResult[] };
  metrics?: unknown;
  extra?: Record<string, unknown>;
};

export type AtifTrajectory = {
  schema_version: string;
  session_id: string;
  agent: {
    name: string;
    version: string;
    model_name: string;
    extra?: Record<string, unknown>;
  };
  steps: AtifStep[];
  final_metrics?: {
    total_steps: number;
    total_prompt_tokens?: number;
    total_completion_tokens?: number;
    total_cached_tokens?: number;
    total_cost_usd?: number;
  };
  extra?: Record<string, unknown>;
};

/**
 * Filter for querying ATIF steps
 */
export type StepFilter = {
  source?: "user" | "agent" | "system";
  hasToolCalls?: boolean;
  hasObservation?: boolean;
  messageContains?: string;
  eventType?: string;
};

/**
 * Assertion error with path information
 */
export class TrajectoryAssertionError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly expected: unknown,
    public readonly actual: unknown
  ) {
    super(
      `${message} at ${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
    this.name = "TrajectoryAssertionError";
  }
}

/**
 * Tool call with resolved step information
 */
export type ResolvedToolCall = AtifToolCall & {
  stepId: number;
  timestamp: string;
  hasResult: boolean;
};

/**
 * Wave information extracted from trajectory
 */
export type WaveInfo = {
  waveId: string;
  startStepId: number;
  endStepId?: number;
  agents: string[];
  status: "running" | "completed" | "aborted";
};

/**
 * Phase information extracted from trajectory
 */
export type PhaseInfo = {
  phaseId: string;
  startStepId: number;
  endStepId?: number;
  status: "running" | "completed" | "failed";
};

/**
 * Plan information extracted from trajectory
 */
export type PlanInfo = {
  planId?: string;
  subtaskCount: number;
  hasDependencies: boolean;
  hasEstimates: boolean;
};
