/**
 * Classification metrics for LLM-first classification pattern
 * Tracks latency, fallback rates, and confidence distributions
 */

import client from "prom-client";
import { metricsRegistry } from "./registry";

/**
 * Classification latency histogram
 * Tracks time spent in LLM classification calls by type and model
 */
export const classificationLatencySeconds = new client.Histogram({
  name: "alfred_classification_latency_seconds",
  help: "LLM classification latency in seconds",
  labelNames: ["type", "model"] as const,
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Classification fallback counter
 * Tracks when classification falls back to heuristics
 */
export const classificationFallbackTotal = new client.Counter({
  name: "alfred_classification_fallback_total",
  help: "Times classification fell back to heuristics",
  labelNames: ["type", "reason"] as const, // reason: "offline" | "error" | "no_model"
  registers: [metricsRegistry],
});

/**
 * Classification confidence gauge
 * Tracks confidence scores returned by LLM classifications
 */
export const classificationConfidence = new client.Histogram({
  name: "alfred_classification_confidence",
  help: "Confidence scores from LLM classifications",
  labelNames: ["type"] as const,
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [metricsRegistry],
});

/**
 * Classification total counter
 * Tracks all classification attempts by type and outcome
 */
export const classificationTotal = new client.Counter({
  name: "alfred_classification_total",
  help: "Total classification attempts",
  labelNames: ["type", "outcome"] as const, // outcome: "success" | "fallback" | "error"
  registers: [metricsRegistry],
});

/**
 * Classification batch size histogram
 * Tracks batch sizes for batch classification calls
 */
export const classificationBatchSize = new client.Histogram({
  name: "alfred_classification_batch_size",
  help: "Number of items in batch classification calls",
  labelNames: ["type"] as const,
  buckets: [1, 2, 5, 10, 20, 50, 100],
  registers: [metricsRegistry],
});

/**
 * Classification cache hit counter (future use)
 * Reserved for when we implement classification result caching
 */
export const classificationCacheHitTotal = new client.Counter({
  name: "alfred_classification_cache_hit_total",
  help: "Cache hits for classification results",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});
