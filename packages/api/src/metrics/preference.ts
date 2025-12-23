import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const preferenceHistoryPrunedTotal = new client.Counter({
  name: "preference_history_pruned_total",
  help: "Count of preference history prune events grouped by source.",
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});

export const preferenceCacheInvalidationsTotal = new client.Counter({
  name: "preference_cache_invalidations_total",
  help: "Count of preference cache invalidations grouped by reason.",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

export const preferenceRefreshTotal = new client.Counter({
  name: "preference_refresh_total",
  help: "Count of preference refresh triggers grouped by reason.",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

export const preferencePromptInjectionsTotal = new client.Counter({
  name: "preference_prompt_injections_total",
  help: "Count of preference prompt injections grouped by source.",
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});

export const preferencePromptFailuresTotal = new client.Counter({
  name: "preference_prompt_failures_total",
  help: "Count of preference prompt build failures grouped by source.",
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});
