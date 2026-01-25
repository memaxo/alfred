/**
 * Unified Tool Execution Context
 *
 * Standardizes execute signatures across all orchestrator tools.
 * Follows ALFRED's "pure by default" principle - context enables,
 * not mandates, side effects.
 */

/**
 * Escalation reasons for agent-initiated environment blockers.
 * These are distinct from automatic stuck detection reasons.
 */
export const AGENT_ESCALATION_REASONS = {
  MISSING_DEPENDENCY: "missing_dependency",
  WRONG_ARCHITECTURE: "wrong_architecture",
  PERMISSION_DENIED: "permission_denied",
  RESOURCE_EXHAUSTED: "resource_exhausted",
  EXTERNAL_SERVICE_UNAVAILABLE: "external_service_unavailable",
  CONFLICTING_REQUIREMENTS: "conflicting_requirements",
  OTHER: "other",
} as const;

export type AgentEscalationReason =
  (typeof AGENT_ESCALATION_REASONS)[keyof typeof AGENT_ESCALATION_REASONS];

/**
 * Escalation event emitted by agents via writer.write().
 * This enables real-time escalation detection by the orchestrator.
 */
export interface AgentEscalationEvent {
  type: "escalate";
  /** The reason category for the escalation */
  reason: AgentEscalationReason;
  /** Detailed description of the blocking issue */
  details: string;
  /** Optional suggestions for resolution */
  suggestions?: string[];
  /** Severity: warning allows continuation, blocking requires immediate response */
  severity: "warning" | "blocking";
}

/**
 * Type guard to check if a writer chunk is an escalation event.
 */
export function isAgentEscalationEvent(
  chunk: unknown
): chunk is AgentEscalationEvent {
  return (
    typeof chunk === "object" &&
    chunk !== null &&
    "type" in chunk &&
    (chunk as { type: unknown }).type === "escalate" &&
    "reason" in chunk &&
    "details" in chunk &&
    "severity" in chunk
  );
}

/**
 * Writer interface for streaming tool output.
 * Includes undefined to support optional writer patterns where
 * callers may not provide a writer at all.
 */
export type ToolWriter =
  | { write: (chunk: unknown) => Promise<void> | void }
  | undefined;

/**
 * Universal execution context for all tools
 * @template TInput The tool's validated input type
 */
export interface ToolExecuteContext<TInput> {
  /** Validated input from tool schema */
  input: TInput;

  /** Optional stream writer for real-time output */
  writer?: ToolWriter;

  /** Optional abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Helper type for tools with simpler signatures
 * Equivalent to Pick<ToolExecuteContext<TInput>, 'input'>
 */
export interface ToolExecuteArgs<TInput> {
  input: TInput;
}
