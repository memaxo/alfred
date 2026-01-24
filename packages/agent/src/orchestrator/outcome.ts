/**
 * Agent Outcome Processing
 *
 * Unified types and utilities for agent execution outcomes.
 * Consolidates outcome handling from runtime and pipeline.
 */

import {
  type FailureContext,
  type LoopDetection,
  type ReviewFailure,
} from "@alfred/type";

import {
  buildFailureContext,
  persistFailureContext,
  type FailureContextInput,
} from "../agentfs/enrichment.js";
import { type AgentFSInterface } from "../agentfs/types.js";
import { type AgentEscalationReason } from "./tool/shared/context.js";

/**
 * Status values for agent execution outcomes.
 */
export const AGENT_STATUS = {
  ESCALATED: "escalated",
  FAILURE: "failure",
  STUCK: "stuck",
  SUCCESS: "success",
  TIMEOUT: "timeout",
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

/**
 * Detailed result from agent execution.
 */
export interface AgentResult {
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
}

/**
 * Full agent execution outcome.
 * This is the canonical type used by runtime/orchestrator.
 */
export interface AgentOutcome {
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
  /** Failure context for non-success outcomes (enrichment system) */
  failureContext?: FailureContext;
}

/**
 * Lightweight outcome for pipeline events.
 * Used in PipelineEvent["agent:complete"].
 */
export interface AgentOutcomeEvent {
  status: AgentStatus;
  durationMs: number;
  handoff?: string;
  error?: string;
}

/**
 * Convert full AgentOutcome to lightweight event outcome.
 */
export function toOutcomeEvent(outcome: AgentOutcome): AgentOutcomeEvent {
  return {
    durationMs: outcome.durationSeconds * 1000,
    error: outcome.escalation ?? (outcome.stuck ? "Agent stuck" : undefined),
    handoff: outcome.result?.branch,
    status: outcome.status,
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
    durationSeconds: 0,
    phaseId,
    result: {
      summary: "",
      artifacts: [],
      changes: [],
      notes: [],
    },
    role,
    status: AGENT_STATUS.SUCCESS,
    stuck: false,
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

// ─────────────────────────────────────────────────────────────────────────────
// Failure Context Integration (Enrichment System)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input for finalizing an outcome with failure context.
 */
export interface FinalizeOutcomeInput {
  /** Loop detection result if available */
  loopResult?: { loop: boolean; reason?: string; layer?: number };
  /** Review failures (lint, test, typecheck) */
  reviewFailures?: Array<{ check: string; evidence: string; file?: string }>;
}

/**
 * Extract task ID from agent ID (format: runId:taskId).
 */
function extractTaskId(agentId: string): string {
  const parts = agentId.split(":");
  return parts.length > 1 ? (parts.at(-1) ?? agentId) : agentId;
}

/**
 * Extract run ID from agent ID (format: runId:taskId).
 */
function extractRunId(agentId: string): string {
  const parts = agentId.split(":");
  return parts[0] ?? "";
}

/**
 * Map AgentStatus to FailureContext status.
 */
function mapToFailureStatus(
  status: AgentStatus
): FailureContext["status"] | null {
  switch (status) {
    case AGENT_STATUS.FAILURE: {
      return "failure";
    }
    case AGENT_STATUS.STUCK: {
      return "stuck";
    }
    case AGENT_STATUS.ESCALATED: {
      return "escalated";
    }
    case AGENT_STATUS.TIMEOUT: {
      return "timeout";
    }
    default: {
      return null;
    }
  }
}

/**
 * Finalize an agent outcome, building and persisting failure context if needed.
 *
 * Call this after agent execution completes to:
 * 1. Build aggregated failure context from all signals
 * 2. Persist to AgentFS KV for downstream enrichment
 * 3. Attach to outcome for immediate access
 */
export async function finalizeOutcome(
  outcome: AgentOutcome,
  agent: AgentFSInterface,
  input?: FinalizeOutcomeInput
): Promise<AgentOutcome> {
  const failureStatus = mapToFailureStatus(outcome.status);

  // Only build failure context for non-success outcomes
  if (!failureStatus) {
    return outcome;
  }

  const taskId = extractTaskId(outcome.agentId);
  const runId = extractRunId(outcome.agentId);

  // Build loop detections from input
  const loopDetections: LoopDetection[] = [];
  if (input?.loopResult?.loop && input.loopResult.reason) {
    loopDetections.push({
      layer: input.loopResult.layer ?? 0,
      reason: input.loopResult.reason,
      ts: Date.now(),
    });
  }

  // Build review failures from input
  const reviewFailures: ReviewFailure[] = (input?.reviewFailures ?? []).map(
    (f) => ({
      check: f.check,
      evidence: f.evidence,
      file: f.file,
    })
  );

  // Build escalations from outcome
  const escalations: FailureContext["escalations"] = [];
  if (outcome.escalationData) {
    escalations.push({
      details: outcome.escalationData.details,
      reason: outcome.escalationData.reason,
      severity: outcome.escalationData.severity,
      ts: Date.now(),
    });
  } else if (outcome.escalation) {
    escalations.push({
      details: outcome.escalation,
      reason: "unknown",
      severity: "warning",
      ts: Date.now(),
    });
  }

  const failureCtxInput: FailureContextInput = {
    durationMs: outcome.durationSeconds * 1000,
    escalations,
    loopDetections,
    reviewFailures,
    stuckReason: outcome.stuck ? "Loop or stall detected" : undefined,
  };

  const failureContext = await buildFailureContext(
    agent,
    taskId,
    runId,
    failureStatus,
    failureCtxInput
  );

  // Persist for downstream enrichment
  await persistFailureContext(agent, failureContext);

  // Return outcome with failure context attached
  return {
    ...outcome,
    failureContext,
  };
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
    avgDurationSeconds:
      outcomes.length > 0 ? totalDuration / outcomes.length : 0,
    escalated,
    failed,
    stuck,
    succeeded,
    total: outcomes.length,
  };
}
