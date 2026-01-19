/**
 * Agent Outcome Processing
 *
 * Unified types and utilities for agent execution outcomes.
 * Consolidates outcome handling from runtime and pipeline.
 */

import type { AgentEscalationReason } from "./tool/shared/context.js";

/**
 * Status values for agent execution outcomes.
 */
export const AGENT_STATUS = {
  SUCCESS: "success",
  FAILURE: "failure",
  ESCALATED: "escalated",
  TIMEOUT: "timeout",
  STUCK: "stuck",
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

/**
 * Detailed result from agent execution.
 */
export type AgentResult = {
  /** Human-readable summary of what the agent did */
  summary: string;
  /** Paths to artifacts created by the agent */
  artifacts: string[];
  /** Paths to files changed by the agent */
  changes: string[];
  /** Additional notes from execution */
  notes: string[];
  /** Git branch if workspace was used */
  branch?: string;
};

/**
 * Full agent execution outcome.
 * This is the canonical type used by runtime/orchestrator.
 */
export type AgentOutcome = {
  /** Unique identifier for this agent */
  agentId: string;
  /** Phase/stage ID during which agent executed */
  phaseId?: string;
  /** Whether agent was detected as stuck (via LoopDetector or timeout) */
  stuck: boolean;
  /** Final status of execution */
  status: AgentStatus;
  /** How long the agent ran in seconds */
  durationSeconds: number;
  /** Role/executor type (codex, droid, opencode) */
  role: string;
  /** Escalation reason if agent escalated */
  escalation?: string;
  /** Structured escalation data if agent used escalate tool */
  escalationData?: {
    reason: AgentEscalationReason;
    details: string;
    suggestions?: string[];
    severity: "warning" | "blocking";
  };
  /** Detailed execution result */
  result?: AgentResult;
};

/**
 * Lightweight outcome for pipeline events.
 * Used in PipelineEvent["agent:complete"].
 */
export type AgentOutcomeEvent = {
  status: AgentStatus;
  durationMs: number;
  handoff?: string;
  error?: string;
};

/**
 * Convert full AgentOutcome to lightweight event outcome.
 */
export function toOutcomeEvent(outcome: AgentOutcome): AgentOutcomeEvent {
  return {
    status: outcome.status,
    durationMs: outcome.durationSeconds * 1000,
    handoff: outcome.result?.branch,
    error: outcome.escalation ?? (outcome.stuck ? "Agent stuck" : undefined),
  };
}

/**
 * Create a default/empty agent outcome.
 */
export function createDefaultOutcome(
  agentId: string,
  role: string,
  phaseId?: string
): AgentOutcome {
  return {
    agentId,
    phaseId,
    stuck: false,
    status: AGENT_STATUS.SUCCESS,
    durationSeconds: 0,
    role,
    result: {
      summary: "",
      artifacts: [],
      changes: [],
      notes: [],
    },
  };
}

/**
 * Check if outcome indicates a terminal failure (not retriable).
 */
export function isTerminalFailure(outcome: AgentOutcome): boolean {
  return (
    outcome.status === AGENT_STATUS.ESCALATED ||
    outcome.escalationData?.severity === "blocking"
  );
}

/**
 * Check if outcome indicates a retriable failure.
 */
export function isRetriableFailure(
  outcome: AgentOutcome,
  retriableStatuses: Set<AgentStatus>
): boolean {
  if (isTerminalFailure(outcome)) {
    return false;
  }
  return retriableStatuses.has(outcome.status);
}

/**
 * Determine the final status based on stuck flag and escalation.
 */
export function determineStatus(
  rawStatus: string,
  stuck: boolean,
  escalation?: string
): AgentStatus {
  if (escalation) {
    return AGENT_STATUS.ESCALATED;
  }
  if (stuck) {
    return AGENT_STATUS.STUCK;
  }
  if (rawStatus === "success" || rawStatus === "completed") {
    return AGENT_STATUS.SUCCESS;
  }
  if (rawStatus === "timeout") {
    return AGENT_STATUS.TIMEOUT;
  }
  if (rawStatus === "stuck") {
    return AGENT_STATUS.STUCK;
  }
  if (rawStatus === "escalated") {
    return AGENT_STATUS.ESCALATED;
  }
  return AGENT_STATUS.FAILURE;
}

/**
 * Merge multiple agent outcomes into a summary.
 */
export function summarizeOutcomes(outcomes: AgentOutcome[]): {
  total: number;
  succeeded: number;
  failed: number;
  stuck: number;
  escalated: number;
  avgDurationSeconds: number;
} {
  const succeeded = outcomes.filter(
    (o) => o.status === AGENT_STATUS.SUCCESS
  ).length;
  const failed = outcomes.filter(
    (o) => o.status === AGENT_STATUS.FAILURE
  ).length;
  const stuck = outcomes.filter((o) => o.status === AGENT_STATUS.STUCK).length;
  const escalated = outcomes.filter(
    (o) => o.status === AGENT_STATUS.ESCALATED
  ).length;
  const totalDuration = outcomes.reduce((sum, o) => sum + o.durationSeconds, 0);

  return {
    total: outcomes.length,
    succeeded,
    failed,
    stuck,
    escalated,
    avgDurationSeconds:
      outcomes.length > 0 ? totalDuration / outcomes.length : 0,
  };
}
