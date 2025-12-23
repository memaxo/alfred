import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const memoryUpdatesTotal = new client.Counter({
  name: "memory_updates_total",
  help: "Count of memory updates grouped by kind and source.",
  labelNames: ["kind", "source"] as const,
  registers: [metricsRegistry],
});

export const memoryForgetsTotal = new client.Counter({
  name: "memory_forgets_total",
  help: "Count of memory forget operations grouped by scope.",
  labelNames: ["scope"] as const,
  registers: [metricsRegistry],
});

export const memoryToolCallsTotal = new client.Counter({
  name: "alfred_memory_tool_calls_total",
  help: "Count of memory tool calls by tool name and status.",
  labelNames: ["tool", "status"] as const,
  registers: [metricsRegistry],
});

export const memorySearchLatencySeconds = new client.Histogram({
  name: "alfred_memory_search_latency_seconds",
  help: "Latency of memory search operations.",
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const memorySearchResultsCount = new client.Histogram({
  name: "alfred_memory_search_results_count",
  help: "Number of results returned by memory search operations.",
  buckets: [0, 1, 5, 10, 20, 50, 100],
  registers: [metricsRegistry],
});

export const memoryTraverseDepth = new client.Histogram({
  name: "alfred_memory_traverse_depth",
  help: "Depth reached during memory graph traversal.",
  buckets: [1, 2, 3, 4, 5],
  registers: [metricsRegistry],
});

export const memoryBoostsTotal = new client.Counter({
  name: "alfred_memory_boosts_total",
  help: "Count of memory boost operations.",
  registers: [metricsRegistry],
});

export const memoryRemovalsTotal = new client.Counter({
  name: "alfred_memory_removals_total",
  help: "Count of memory removal operations by type.",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});

// Hook registration for lazy wiring
let updatesCounter: typeof memoryUpdatesTotal | undefined;
let forgetsCounter: typeof memoryForgetsTotal | undefined;

export function registerMemoryUpdatesCounter(
  counter: typeof memoryUpdatesTotal
) {
  updatesCounter = counter;
}

export function registerMemoryForgetsCounter(
  counter: typeof memoryForgetsTotal
) {
  forgetsCounter = counter;
}

export function recordMemoryUpdate(kind: string, source: string) {
  updatesCounter?.inc({ kind, source });
  memoryUpdatesTotal.inc({ kind, source });
}

export function recordMemoryForget(scope: string) {
  forgetsCounter?.inc({ scope });
  memoryForgetsTotal.inc({ scope });
}

export function recordMemoryToolCall(tool: string, status: "success" | "error") {
  memoryToolCallsTotal.inc({ tool, status });
}

export function recordMemorySearchLatency(durationSeconds: number) {
  memorySearchLatencySeconds.observe(durationSeconds);
}

export function recordMemorySearchResults(count: number) {
  memorySearchResultsCount.observe(count);
}

export function recordMemoryTraverseDepth(depth: number) {
  memoryTraverseDepth.observe(depth);
}

export function recordMemoryBoost() {
  memoryBoostsTotal.inc();
}

export function recordMemoryRemoval(type: "archived" | "deleted") {
  memoryRemovalsTotal.inc({ type });
}
