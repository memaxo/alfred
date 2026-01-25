/**
 * AgentFS Live Error Streaming
 *
 * Enables real-time error streaming between sibling agents
 * so they can learn from each other's failures during execution.
 */

import { enrichCaps, type LiveError, liveErrorSchema } from "@alfred/type";

import type { AgentFSInterface } from "./types.js";

import { redactObject, redactSecrets } from "../utils/redaction.js";
import { AGENTFS_KV_KEYS, LIVE_ERROR_PREFIX } from "./keys.js";

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

/**
 * Emit a live error to AgentFS KV for sibling agent awareness.
 *
 * Called during tool execution when an error occurs,
 * allowing sibling agents to query and avoid similar failures.
 */
export async function emitLiveError(
  agent: AgentFSInterface,
  error: LiveError
): Promise<void> {
  if (!isEnrichmentEnabled()) {
    return;
  }
  const normalized: LiveError = {
    ...error,
    createdAt: error.createdAt ?? error.ts,
    error: capText(redactSecrets(error.error), enrichCaps.liveErr),
    parameters: error.parameters ? capParams(error.parameters) : undefined,
    schemaVersion: error.schemaVersion ?? 1,
  };
  await agent.kv.set(
    AGENTFS_KV_KEYS.liveError(error.ts),
    liveErrorSchema.parse(normalized)
  );
}

/**
 * Query recent live errors from the shared AgentFS KV store.
 *
 * Sibling agents can call this to see what errors have occurred
 * recently and adjust their approach accordingly.
 */
export async function getLiveErrors(
  agent: AgentFSInterface,
  sinceTs: number
): Promise<LiveError[]> {
  if (!isEnrichmentEnabled()) {
    return [];
  }
  const entries = await agent.kv.list(LIVE_ERROR_PREFIX);

  return entries
    .filter((e) => {
      const keyTs = e.key.replace(LIVE_ERROR_PREFIX, "");
      const ts = Number.parseInt(keyTs, 10);
      return !Number.isNaN(ts) && ts >= sinceTs;
    })
    .map((e) => {
      const parsed = liveErrorSchema.safeParse(e.value);
      return parsed.success ? parsed.data : null;
    })
    .filter((err): err is LiveError =>
      Boolean(err && typeof err.tool === "string")
    )
    .sort((a, b) => b.ts - a.ts);
}

/**
 * Get errors for a specific tool.
 */
export async function getLiveErrorsForTool(
  agent: AgentFSInterface,
  toolName: string,
  sinceTs: number
): Promise<LiveError[]> {
  if (!isEnrichmentEnabled()) {
    return [];
  }
  const allErrors = await getLiveErrors(agent, sinceTs);
  return allErrors.filter((e) => e.tool === toolName);
}

/**
 * Check if a tool has been failing recently.
 *
 * Useful for agents to decide whether to try an alternative approach.
 */
export async function isToolFailing(
  agent: AgentFSInterface,
  toolName: string,
  options?: {
    sinceTs?: number;
    minFailures?: number;
  }
): Promise<boolean> {
  if (!isEnrichmentEnabled()) {
    return false;
  }
  const sinceTs = options?.sinceTs ?? Date.now() - 5 * 60 * 1000; // Last 5 minutes
  const minFailures = options?.minFailures ?? 2;

  const errors = await getLiveErrorsForTool(agent, toolName, sinceTs);
  return errors.length >= minFailures;
}

/**
 * Get a summary of recent tool failures.
 *
 * Returns a map of tool names to failure counts for quick lookup.
 */
export async function getToolFailureSummary(
  agent: AgentFSInterface,
  sinceTs: number
): Promise<Map<string, number>> {
  const errors = await getLiveErrors(agent, sinceTs);
  const summary = new Map<string, number>();

  for (const error of errors) {
    const current = summary.get(error.tool) ?? 0;
    summary.set(error.tool, current + 1);
  }

  return summary;
}

/**
 * Clear old live errors to prevent unbounded growth.
 *
 * Should be called periodically (e.g., at wave completion).
 */
export async function clearOldLiveErrors(
  agent: AgentFSInterface,
  olderThanTs: number
): Promise<number> {
  if (!isEnrichmentEnabled()) {
    return 0;
  }
  const entries = await agent.kv.list(LIVE_ERROR_PREFIX);
  let deleted = 0;

  for (const entry of entries) {
    const keyTs = entry.key.replace(LIVE_ERROR_PREFIX, "");
    const ts = Number.parseInt(keyTs, 10);

    if (!Number.isNaN(ts) && ts < olderThanTs) {
      await agent.kv.delete(entry.key);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Build a context string from recent live errors for prompt injection.
 */
export async function buildLiveErrorContext(
  agent: AgentFSInterface,
  sinceTs: number,
  maxErrors = 5
): Promise<string | null> {
  if (!isEnrichmentEnabled()) {
    return null;
  }
  const errors = await getLiveErrors(agent, sinceTs);

  if (errors.length === 0) {
    return null;
  }

  const recentErrors = errors.slice(0, maxErrors);
  const lines = recentErrors.map(
    (e) =>
      `- ${e.tool}: ${e.error.slice(0, 100)}${e.error.length > 100 ? "..." : ""}`
  );

  return `Recent tool failures in this workflow:\n${lines.join("\n")}`;
}
