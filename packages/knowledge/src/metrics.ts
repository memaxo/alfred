import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

// Performance measurement utilities
function nowNs(): bigint {
  return process.hrtime.bigint();
}

type MaybePromise<T> = T | Promise<T>;

type Runner<T> = () => MaybePromise<T>;

function elapsedMs(start: bigint): number {
  return Number(nowNs() - start) / 1_000_000;
}

function logBudget(_label: string, duration: number, budgetMs: number): void {
  if (duration > budgetMs) {
  }
}

export function measureSync<T>(
  label: string,
  budgetMs: number,
  fn: () => T
): T {
  const start = nowNs();
  try {
    return fn();
  } finally {
    logBudget(label, elapsedMs(start), budgetMs);
  }
}

export async function measureAsync<T>(
  label: string,
  budgetMs: number,
  fn: Runner<T>
): Promise<T> {
  const start = nowNs();
  try {
    return await fn();
  } finally {
    logBudget(label, elapsedMs(start), budgetMs);
  }
}

// Classification metrics
export const classificationSourceTotal = new client.Counter({
  name: "alfred_classification_source_total",
  help: "Count of domain classifications grouped by domain and source.",
  labelNames: ["domain", "source"] as const,
  registers: [metricsRegistry],
});

export const classificationAccuracyTotal = new client.Counter({
  name: "alfred_classification_accuracy_total",
  help: "Count of classification outcomes (confirmed vs corrected).",
  labelNames: ["domain", "outcome"] as const,
  registers: [metricsRegistry],
});

export const classificationDurationSeconds = new client.Histogram({
  name: "alfred_classification_duration_seconds",
  help: "Duration of domain classification operations in seconds.",
  labelNames: ["method"] as const,
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [metricsRegistry],
});

export const domainCacheHitsTotal = new client.Counter({
  name: "alfred_domain_cache_hits_total",
  help: "Count of domain cache hits and misses.",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

// Memory system enhancement metrics
export const embeddingQuantizationsTotal = new client.Counter({
  name: "alfred_embedding_quantizations_total",
  help: "Count of embedding quantization operations by status.",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const embeddingStorageSavedBytes = new client.Counter({
  name: "alfred_embedding_storage_saved_bytes",
  help: "Total bytes saved through int8 quantization.",
  registers: [metricsRegistry],
});

export const adaptiveDecayOperationsTotal = new client.Counter({
  name: "alfred_adaptive_decay_operations_total",
  help: "Count of adaptive decay operations by outcome.",
  labelNames: ["outcome"] as const,
  registers: [metricsRegistry],
});

export const nodeAccessCountHistogram = new client.Histogram({
  name: "alfred_node_access_count",
  help: "Distribution of node access counts.",
  buckets: [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry],
});

export const domainThresholdCalibrationTotal = new client.Counter({
  name: "alfred_domain_threshold_calibrations_total",
  help: "Count of domain threshold calibration events by domain.",
  labelNames: ["domain"] as const,
  registers: [metricsRegistry],
});

export const domainThresholdGauge = new client.Gauge({
  name: "alfred_domain_threshold",
  help: "Current override threshold per domain.",
  labelNames: ["domain"] as const,
  registers: [metricsRegistry],
});

export const domainAccuracyGauge = new client.Gauge({
  name: "alfred_domain_accuracy",
  help: "Current classification accuracy per domain.",
  labelNames: ["domain"] as const,
  registers: [metricsRegistry],
});

// DSA-BFS traversal metrics
export const dsaBfsTraversalsTotal = new client.Counter({
  name: "alfred_dsa_bfs_traversals_total",
  help: "Count of DSA-BFS traversal operations by outcome.",
  labelNames: ["outcome"] as const,
  registers: [metricsRegistry],
});

export const dsaBfsExpansionsHistogram = new client.Histogram({
  name: "alfred_dsa_bfs_expansions",
  help: "Distribution of node expansions per DSA-BFS traversal.",
  buckets: [1, 5, 10, 25, 50, 100, 200, 500],
  registers: [metricsRegistry],
});

export const dsaBfsDurationSeconds = new client.Histogram({
  name: "alfred_dsa_bfs_duration_seconds",
  help: "Duration of DSA-BFS traversal operations.",
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

// CRAG retrieval evaluation metrics
export const cragEvaluationsTotal = new client.Counter({
  name: "alfred_crag_evaluations_total",
  help: "Count of CRAG evaluations by action decision.",
  labelNames: ["action"] as const,
  registers: [metricsRegistry],
});

export const cragScoreHistogram = new client.Histogram({
  name: "alfred_crag_score",
  help: "Distribution of CRAG evaluation scores.",
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  registers: [metricsRegistry],
});

// Concept drift detection metrics
export const conceptDriftDetectionsTotal = new client.Counter({
  name: "alfred_concept_drift_detections_total",
  help: "Count of concept drift detection events by domain.",
  labelNames: ["domain"] as const,
  registers: [metricsRegistry],
});

export const conceptDriftWindowSize = new client.Gauge({
  name: "alfred_concept_drift_window_size",
  help: "Current ADWIN window size per domain.",
  labelNames: ["domain"] as const,
  registers: [metricsRegistry],
});

// Bi-temporal edge metrics
export const bitemporalEdgeOperationsTotal = new client.Counter({
  name: "alfred_bitemporal_edge_operations_total",
  help: "Count of bi-temporal edge operations by type.",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

export const bitemporalHistoricalQueriesTotal = new client.Counter({
  name: "alfred_bitemporal_historical_queries_total",
  help: "Count of historical graph queries.",
  registers: [metricsRegistry],
});
