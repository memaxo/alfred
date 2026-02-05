import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const historyContextTokensTotal = new client.Counter({
  name: "history_context_tokens_total",
  help: "Total tokens considered by history selection grouped by source, model, and action.",
  labelNames: ["source", "model", "action"] as const,
  registers: [metricsRegistry],
});

export const historyContextTierDropsTotal = new client.Counter({
  name: "history_context_tier_drops_total",
  help: "Count of dropped messages grouped by source and tier.",
  labelNames: ["source", "tier"] as const,
  registers: [metricsRegistry],
});

export const historyContextSelectionDurationSeconds = new client.Histogram({
  name: "history_context_selection_duration_seconds",
  help: "Duration of token-aware history selection grouped by source.",
  labelNames: ["source"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [metricsRegistry],
});

export const historySummarizationsTotal = new client.Counter({
  name: "history_summarizations_total",
  help: "Count of history summarization events grouped by source and reason.",
  labelNames: ["source", "reason"] as const,
  registers: [metricsRegistry],
});

export const contextBudgetAllocation = new client.Histogram({
  name: "context_budget_allocation",
  help: "Allocated tokens per context source grouped by source and model.",
  labelNames: ["source", "model"] as const,
  buckets: [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16_000, 32_000, 64_000],
  registers: [metricsRegistry],
});

export const contextBudgetUtilization = new client.Histogram({
  name: "context_budget_utilization",
  help: "Utilization ratio (used/allocated) per context source grouped by source and model.",
  labelNames: ["source", "model"] as const,
  buckets: [0, 0.1, 0.25, 0.5, 0.75, 0.85, 0.92, 1, 1.1, 1.25],
  registers: [metricsRegistry],
});

export const toolResultTruncatedTotal = new client.Counter({
  name: "tool_result_truncated_total",
  help: "Count of tool-result truncations grouped by source, toolName, and storage outcome.",
  labelNames: ["source", "toolName", "stored"] as const,
  registers: [metricsRegistry],
});

export const contextCompressionRatio = new client.Histogram({
  name: "context_compression_ratio",
  help: "Ratio of compressed tokens to original tokens for history compression.",
  labelNames: ["source", "method"] as const,
  buckets: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
  registers: [metricsRegistry],
});
