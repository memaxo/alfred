/**
 * AgentFS KV Key Conventions
 *
 * Centralized key generation for AgentFS KV store entries.
 * All enrichment-related data uses these patterns.
 */

export const AGENTFS_KV_KEYS = {
  /** Per-task failure context aggregation */
  failureContext: (taskId: string) => `failure:${taskId}`,

  /** Live errors streamed during execution */
  liveError: (ts: number) => `live-error:${ts}`,

  /** Retry resolution records linking failures to fixes */
  retryResolution: (taskId: string, attempt: number) =>
    `retry:${taskId}:${attempt}`,

  /** Structured handoff from previous wave */
  handoff: (waveId: string) => `handoff:${waveId}`,

  /** Task learnings from reflect tool */
  taskLearnings: (taskId: string) => `learnings:${taskId}`,

  /** Decisions made during task execution */
  decisions: (taskId: string) => `decisions:${taskId}`,

  /** Tools that failed repeatedly (for avoidance hints) */
  failedTools: (taskId: string) => `failed-tools:${taskId}`,

  /** LLM-judged signals for a task/run (privacy-preserving summaries) */
  signals: (taskId: string) => `signals:${taskId}`,
} as const;

/** Prefix for listing live errors */
export const LIVE_ERROR_PREFIX = "live-error:";

/** Prefix for listing failure contexts */
export const FAILURE_PREFIX = "failure:";

/** Prefix for listing retry resolutions */
export const RETRY_PREFIX = "retry:";

/** Prefix for listing handoffs */
export const HANDOFF_PREFIX = "handoff:";

/** Prefix for listing signals */
export const SIGNALS_PREFIX = "signals:";
