/**
 * AgentFS Enrichment Persistence
 *
 * Helpers for persisting and querying enrichment data
 * (failure contexts, handoffs, retry resolutions) via AgentFS KV.
 */

import {
  type FailureContext,
  type RetryResolution,
  type StructuredHandoff,
  enrichCaps,
  failureContextSchema,
  retryResolutionSchema,
  structuredHandoffSchema,
} from "@alfred/type";

import type { AgentFSInterface } from "./types.js";

import { redactObject, redactSecrets } from "../utils/redaction.js";
import { AGENTFS_KV_KEYS, FAILURE_PREFIX, RETRY_PREFIX } from "./keys.js";

function capText(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…<truncated>`;
}

function capParams(params: unknown): unknown {
  const redacted = redactObject(params);
  try {
    const raw = JSON.stringify(redacted);
    if (raw.length <= enrichCaps.errParam) {
      return redacted;
    }
    return capText(raw, enrichCaps.errParam);
  } catch {
    return undefined;
  }
}

function isEnrichmentEnabled(): boolean {
  return process.env.ALFRED_ENRICHMENT === "1";
}

// ─────────────────────────────────────────────────────────────────────────────
// FailureContext
// ─────────────────────────────────────────────────────────────────────────────

export async function persistFailureContext(
  agent: AgentFSInterface,
  ctx: FailureContext
): Promise<void> {
  if (!isEnrichmentEnabled()) {
    return;
  }
  await agent.kv.set(
    AGENTFS_KV_KEYS.failureContext(ctx.taskId),
    failureContextSchema.parse(ctx)
  );
}

export async function getFailureContext(
  agent: AgentFSInterface,
  taskId: string
): Promise<FailureContext | undefined> {
  if (!isEnrichmentEnabled()) {
    return undefined;
  }
  const raw = await agent.kv.get<unknown>(
    AGENTFS_KV_KEYS.failureContext(taskId)
  );
  const parsed = failureContextSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export async function listFailureContexts(
  agent: AgentFSInterface
): Promise<FailureContext[]> {
  if (!isEnrichmentEnabled()) {
    return [];
  }
  const entries = await agent.kv.list(FAILURE_PREFIX);
  return entries
    .map((e) => {
      const parsed = failureContextSchema.safeParse(e.value);
      return parsed.success ? parsed.data : null;
    })
    .filter((ctx): ctx is FailureContext => Boolean(ctx && ctx.taskId));
}

// ─────────────────────────────────────────────────────────────────────────────
// StructuredHandoff
// ─────────────────────────────────────────────────────────────────────────────

export async function persistStructuredHandoff(
  agent: AgentFSInterface,
  waveId: string,
  handoff: StructuredHandoff
): Promise<void> {
  if (!isEnrichmentEnabled()) {
    return;
  }
  await agent.kv.set(
    AGENTFS_KV_KEYS.handoff(waveId),
    structuredHandoffSchema.parse(handoff)
  );
}

export async function getStructuredHandoff(
  agent: AgentFSInterface,
  waveId: string
): Promise<StructuredHandoff | undefined> {
  if (!isEnrichmentEnabled()) {
    return undefined;
  }
  const raw = await agent.kv.get<unknown>(AGENTFS_KV_KEYS.handoff(waveId));
  const parsed = structuredHandoffSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// RetryResolution
// ─────────────────────────────────────────────────────────────────────────────

export async function persistRetryResolution(
  agent: AgentFSInterface,
  resolution: RetryResolution
): Promise<void> {
  if (!isEnrichmentEnabled()) {
    return;
  }
  const key = AGENTFS_KV_KEYS.retryResolution(
    resolution.taskId,
    resolution.attempt
  );
  await agent.kv.set(key, retryResolutionSchema.parse(resolution));
}

export async function getRetryResolutions(
  agent: AgentFSInterface,
  taskId: string
): Promise<RetryResolution[]> {
  if (!isEnrichmentEnabled()) {
    return [];
  }
  const entries = await agent.kv.list(`${RETRY_PREFIX}${taskId}:`);
  return entries
    .map((e) => {
      const parsed = retryResolutionSchema.safeParse(e.value);
      return parsed.success ? parsed.data : null;
    })
    .filter((r): r is RetryResolution => Boolean(r && r.taskId))
    .sort((a, b) => a.attempt - b.attempt);
}

export async function listAllRetryResolutions(
  agent: AgentFSInterface
): Promise<RetryResolution[]> {
  if (!isEnrichmentEnabled()) {
    return [];
  }
  const entries = await agent.kv.list(RETRY_PREFIX);
  return entries
    .map((e) => {
      const parsed = retryResolutionSchema.safeParse(e.value);
      return parsed.success ? parsed.data : null;
    })
    .filter((r): r is RetryResolution => Boolean(r && r.taskId))
    .sort((a, b) => b.ts - a.ts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Decisions
// ─────────────────────────────────────────────────────────────────────────────

export interface Decision {
  decision: string;
  rationale: string;
  confidence?: "low" | "medium" | "high";
  ts: number;
}

export async function persistDecision(
  agent: AgentFSInterface,
  taskId: string,
  decision: Decision
): Promise<void> {
  if (!isEnrichmentEnabled()) {
    return;
  }
  const existing = await getDecisions(agent, taskId);
  existing.push(decision);
  await agent.kv.set(AGENTFS_KV_KEYS.decisions(taskId), existing);
}

export async function getDecisions(
  agent: AgentFSInterface,
  taskId: string
): Promise<Decision[]> {
  if (!isEnrichmentEnabled()) {
    return [];
  }
  const decisions = await agent.kv.get<Decision[]>(
    AGENTFS_KV_KEYS.decisions(taskId)
  );
  return decisions ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Learnings — REMOVED
// ─────────────────────────────────────────────────────────────────────────────
// persistTaskLearning() and getTaskLearnings() were deleted.
// Orchestrator ephemeral learnings now persist to Postgres memory_nodes
// (kind = "task_learning") via ReflectionObserver + PersistLearningFn callback.
// See packages/pipeline/src/observers/reflect.ts and
// packages/api/src/routers/workflow/phase/execute.ts.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// FailureContext Builder
// ─────────────────────────────────────────────────────────────────────────────

export interface FailureContextInput {
  loopDetections?: FailureContext["loopDetections"];
  escalations?: FailureContext["escalations"];
  reviewFailures?: FailureContext["reviewFailures"];
  stuckReason?: string;
  durationMs?: number;
}

export async function buildFailureContext(
  agent: AgentFSInterface,
  taskId: string,
  runId: string,
  status: FailureContext["status"],
  input?: FailureContextInput
): Promise<FailureContext> {
  const stats = await agent.tools.getStats();
  const toolErrors: FailureContext["toolErrors"] = [];

  for (const stat of stats) {
    if (stat.failed > 0) {
      toolErrors.push({
        count: stat.failed,
        error: "See tool call history",
        lastOccurrence: Date.now(),
        tool: stat.name,
      });
    }
  }

  // Enrich with actual error messages from recent calls
  const oneHourAgo = Math.floor((Date.now() - 3_600_000) / 1000);
  const recentCalls = await agent.tools.getRecent(oneHourAgo, 100);
  for (const call of recentCalls) {
    if (call.error) {
      const existing = toolErrors.find((e) => e.tool === call.name);
      if (existing) {
        existing.error = capText(redactSecrets(call.error), enrichCaps.errMsg);
        existing.lastOccurrence = call.completed_at * 1000;
        if (call.parameters) {
          existing.parameters = capParams(call.parameters);
        }
      }
    }
  }

  const ts = Date.now();
  return {
    createdAt: ts,
    durationMs: input?.durationMs ?? 0,
    escalations: input?.escalations ?? [],
    loopDetections: input?.loopDetections ?? [],
    signals: [],
    delight: [],
    interventions: [],
    reviewFailures: input?.reviewFailures ?? [],
    runId,
    schemaVersion: 1,
    status,
    stuckReason: input?.stuckReason,
    taskId,
    toolErrors,
    ts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function getFailedToolsSummary(
  agent: AgentFSInterface
): Promise<Map<string, number>> {
  const failures = await listFailureContexts(agent);
  const toolCounts = new Map<string, number>();

  for (const failure of failures) {
    for (const err of failure.toolErrors) {
      const current = toolCounts.get(err.tool) ?? 0;
      toolCounts.set(err.tool, current + err.count);
    }
  }

  return toolCounts;
}

export async function getCommonErrorPatterns(
  agent: AgentFSInterface,
  limit = 10
): Promise<{ tool: string; error: string; count: number }[]> {
  const failures = await listFailureContexts(agent);
  const errorCounts = new Map<
    string,
    { tool: string; error: string; count: number }
  >();

  for (const failure of failures) {
    for (const err of failure.toolErrors) {
      const key = `${err.tool}:${err.error.slice(0, 100)}`;
      const existing = errorCounts.get(key);
      if (existing) {
        existing.count += err.count;
      } else {
        errorCounts.set(key, {
          count: err.count,
          error: err.error,
          tool: err.tool,
        });
      }
    }
  }

  return [...errorCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry Resolution Tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input for creating a retry resolution record.
 */
export interface RetryResolutionInput {
  taskId: string;
  runId: string;
  attempt: number;
  failureContext: FailureContext;
  successContext: {
    toolsUsed: string[];
    filesChanged: string[];
    durationMs: number;
    exitCode?: number;
  };
  delta: string;
}

/**
 * Create and persist a retry resolution after successful retry.
 */
export async function createRetryResolution(
  agent: AgentFSInterface,
  input: RetryResolutionInput
): Promise<RetryResolution> {
  const ts = Date.now();
  const resolution: RetryResolution = {
    attempt: input.attempt,
    createdAt: ts,
    delta: capText(redactSecrets(input.delta), enrichCaps.delta),
    failureContext: input.failureContext,
    runId: input.runId,
    schemaVersion: 1,
    successContext: input.successContext,
    taskId: input.taskId,
    ts,
  };

  await persistRetryResolution(agent, resolution);
  return resolution;
}

/**
 * Check if a task has any successful retry resolutions.
 */
export async function hasSuccessfulRetry(
  agent: AgentFSInterface,
  taskId: string
): Promise<boolean> {
  const resolutions = await getRetryResolutions(agent, taskId);
  return resolutions.length > 0;
}

/**
 * Get the latest retry resolution for a task.
 */
export async function getLatestRetryResolution(
  agent: AgentFSInterface,
  taskId: string
): Promise<RetryResolution | undefined> {
  const resolutions = await getRetryResolutions(agent, taskId);
  return resolutions.at(-1);
}

/**
 * Build a summary of retry patterns for analysis.
 */
export async function getRetryPatternSummary(agent: AgentFSInterface): Promise<{
  totalRetries: number;
  avgAttemptsToSuccess: number;
  commonFixes: { pattern: string; count: number }[];
}> {
  const allResolutions = await listAllRetryResolutions(agent);

  if (allResolutions.length === 0) {
    return {
      avgAttemptsToSuccess: 0,
      commonFixes: [],
      totalRetries: 0,
    };
  }

  // Group by task to find attempts per task
  const taskAttempts = new Map<string, number>();
  for (const r of allResolutions) {
    const current = taskAttempts.get(r.taskId) ?? 0;
    taskAttempts.set(r.taskId, Math.max(current, r.attempt));
  }

  const attempts = [...taskAttempts.values()];
  const avgAttempts = attempts.reduce((a, b) => a + b, 0) / attempts.length;

  // Count common fix patterns (simplified - just count by delta prefix)
  const fixCounts = new Map<string, number>();
  for (const r of allResolutions) {
    const pattern = r.delta.slice(0, 50);
    const current = fixCounts.get(pattern) ?? 0;
    fixCounts.set(pattern, current + 1);
  }

  const commonFixes = [...fixCounts.entries()]
    .map(([pattern, count]) => ({ count, pattern }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    avgAttemptsToSuccess: avgAttempts,
    commonFixes,
    totalRetries: allResolutions.length,
  };
}

/**
 * Find resolutions that fixed similar errors to a given failure.
 */
export async function findSimilarResolutions(
  agent: AgentFSInterface,
  failure: FailureContext,
  limit = 3
): Promise<RetryResolution[]> {
  const allResolutions = await listAllRetryResolutions(agent);

  // Simple matching: look for resolutions with similar tool errors
  const failedTools = new Set(failure.toolErrors.map((e) => e.tool));

  const matches = allResolutions
    .filter((r) => {
      const originalTools = new Set(
        r.failureContext.toolErrors.map((e: { tool: string }) => e.tool)
      );
      // Check for overlap in failed tools
      for (const tool of failedTools) {
        if (originalTools.has(tool)) {
          return true;
        }
      }
      return false;
    })
    .slice(0, limit);

  return matches;
}

/**
 * Build enrichment context from similar past resolutions.
 */
export async function buildResolutionContext(
  agent: AgentFSInterface,
  failure: FailureContext,
  maxTokens = 500
): Promise<string | null> {
  const similar = await findSimilarResolutions(agent, failure, 3);

  if (similar.length === 0) {
    return null;
  }

  const lines: string[] = [
    "Similar issues were resolved in previous attempts:",
    "",
  ];

  let tokenEstimate = 20;

  for (const r of similar) {
    const line = `- Attempt ${r.attempt}: ${r.delta.slice(0, 100)}`;
    const lineTokens = Math.ceil(line.length / 4);

    if (tokenEstimate + lineTokens > maxTokens) {
      break;
    }

    lines.push(line);
    tokenEstimate += lineTokens;

    // Add files changed info
    if (r.successContext.filesChanged.length > 0) {
      const files = `  Files: ${r.successContext.filesChanged.slice(0, 3).join(", ")}`;
      const filesTokens = Math.ceil(files.length / 4);
      if (tokenEstimate + filesTokens <= maxTokens) {
        lines.push(files);
        tokenEstimate += filesTokens;
      }
    }
  }

  return lines.join("\n");
}
