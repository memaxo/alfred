import type { ModelProvider } from "@alfred/type/model";

import { costTrackerMetrics } from "./metrics-registry";
import { calculateCostUsd } from "./pricing";

/**
 * Cost Tracking Module
 *
 * Tracks token usage and USD costs per workflow run.
 */

export type CostEntry = {
  runId: string;
  provider: ModelProvider;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  timestamp: Date;
};

export type RunCostSummary = {
  runId: string;
  totalCostUsd: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  entries: CostEntry[];
};

// In-memory cost tracking per run
const runCosts = new Map<string, CostEntry[]>();

/**
 * Record cost for a model call.
 */
export function recordCost(
  provider: ModelProvider,
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  runId: string
): number {
  const costUsd = calculateCostUsd(
    provider,
    modelId,
    promptTokens,
    completionTokens
  );

  const entry: CostEntry = {
    runId,
    provider,
    modelId,
    promptTokens,
    completionTokens,
    costUsd,
    timestamp: new Date(),
  };

  // Store entry
  const entries = runCosts.get(runId) || [];
  entries.push(entry);
  runCosts.set(runId, entries);

  // Update metrics
  costTrackerMetrics.costUsd.inc({ provider }, costUsd);
  costTrackerMetrics.tokens.inc(
    { provider, token_type: "prompt" },
    promptTokens
  );
  costTrackerMetrics.tokens.inc(
    { provider, token_type: "completion" },
    completionTokens
  );

  return costUsd;
}

/**
 * Get cost summary for a run.
 */
export function getRunCostSummary(runId: string): RunCostSummary {
  const entries = runCosts.get(runId) || [];

  const totalCostUsd = entries.reduce((sum, e) => sum + e.costUsd, 0);
  const totalPromptTokens = entries.reduce((sum, e) => sum + e.promptTokens, 0);
  const totalCompletionTokens = entries.reduce(
    (sum, e) => sum + e.completionTokens,
    0
  );

  return {
    runId,
    totalCostUsd,
    totalPromptTokens,
    totalCompletionTokens,
    entries,
  };
}

/**
 * Check if run is approaching budget limit.
 */
export function checkBudget(
  runId: string,
  budgetUsd: number
): {
  exceeded: boolean;
  approaching: boolean; // within 10% of budget
  costUsd: number;
  budgetUsd: number;
} {
  const summary = getRunCostSummary(runId);
  const exceeded = summary.totalCostUsd >= budgetUsd;
  const approaching = summary.totalCostUsd >= budgetUsd * 0.9;

  if (exceeded || approaching) {
    costTrackerMetrics.budgetAlerts.inc({
      alert_type: exceeded ? "exceeded" : "approaching",
    });
  }

  return {
    exceeded,
    approaching,
    costUsd: summary.totalCostUsd,
    budgetUsd,
  };
}

/**
 * Clear cost tracking for a run (after completion).
 */
export function clearRunCosts(runId: string): void {
  runCosts.delete(runId);
}

/**
 * Get all tracked runs (for debugging).
 */
export function getTrackedRuns(): string[] {
  return Array.from(runCosts.keys());
}
