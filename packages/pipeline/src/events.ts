import type { AgentEscalationReason } from "@alfred/agent/orchestrator/tool/shared/context";
import type { SignalsJudgeOutput } from "@alfred/type";

import type { StageName } from "./pipeline";
import type { SerializableValue } from "./snapshot";

// Re-export for convenience
export type { AgentEscalationReason };

// Agent execution outcome
export interface AgentOutcome {
  status: "success" | "failure" | "escalated" | "timeout" | "stuck";
  durationMs: number;
  handoff?: string;
  error?: string;
}

// Knowledge insight from learning
export interface KnowledgeInsight {
  type: "heuristic" | "mistake" | "pattern";
  content: string;
  confidence: number;
}

// Review check result
export interface ReviewCheck {
  name: string;
  passed: boolean;
  message?: string;
}

// Execution summary
export interface ExecutionSummary {
  runId: string;
  requirement: string;
  stages: { name: StageName; durationMs: number; status: string }[];
  totalDurationMs: number;
  agentsSpawned: number;
  filesChanged: number;
  learningInsights: number;
}

// Union of all pipeline events
export type PipelineEvent =
  // Stage lifecycle events
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
  // Agent lifecycle events
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
  | {
      type: "agent:stuck";
      agentId: string;
      reason: "no_progress" | "loop_detected";
      timestamp: number;
    }
  | {
      type: "agent:escalated";
      agentId: string;
      reason: string;
      timestamp: number;
    }
  | {
      /** Real-time escalation request from agent via escalate tool */
      type: "agent:escalate-request";
      agentId: string;
      reason: AgentEscalationReason;
      details: string;
      suggestions?: string[];
      severity: "warning" | "blocking";
      timestamp: number;
    }
  | {
      type: "agent:retry";
      agentId: string;
      attempt: number;
      maxAttempts: number;
      timestamp: number;
    }
  | {
      /**
       * LLM-judged signals emitted from agent traces.
       * Contains abstract citations only (no raw content/code/PII).
       */
      type: "agent:signal";
      agentId: string;
      signals: SignalsJudgeOutput;
      timestamp: number;
    }
  // Review events
  | { type: "review:check"; check: ReviewCheck; timestamp: number }
  | {
      type: "review:fix-start";
      attempt: number;
      maxAttempts: number;
      timestamp: number;
    }
  | {
      type: "review:fix-complete";
      attempt: number;
      success: boolean;
      timestamp: number;
    }
  // Learning events
  | { type: "learn:insight"; insight: KnowledgeInsight; timestamp: number }
  // Wave events
  | {
      type: "wave:aborted";
      waveId: string;
      waveFailRate: number;
      overallFailRate: number;
      timestamp: number;
    }
  // Context events (for reconstruction)
  | {
      type: "context:set";
      key: string;
      value: SerializableValue;
      timestamp: number;
    }
  | { type: "context:cache-hit"; cacheKey: string; timestamp: number }
  // Budget events
  | {
      type: "budget:warning";
      costUsd: number;
      budgetUsd: number;
      percentUsed: number;
      timestamp: number;
    }
  | {
      type: "budget:exceeded";
      costUsd: number;
      budgetUsd: number;
      timestamp: number;
    }
  // Pipeline lifecycle events
  | {
      type: "pipeline:start";
      runId: string;
      requirement: string;
      timestamp: number;
    }
  | { type: "pipeline:suspend"; reason: string; timestamp: number }
  | { type: "pipeline:resume"; fromStage: StageName; timestamp: number }
  | {
      type: "pipeline:complete";
      summary: ExecutionSummary;
      summaryText?: string;
      timestamp: number;
    }
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
