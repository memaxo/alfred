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
