/**
 * Embedding Metrics
 * Prometheus metrics for queue and pool observability
 */

import client from "prom-client";
import type { QueueStats } from "./queue";

// Create a dedicated registry for embed metrics
const embedRegistry = new client.Registry();

function safeRegisterCounter(
  config: client.CounterConfiguration<string>
): client.Counter<string> {
  const existing = embedRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Counter<string>;
  }
  return new client.Counter({ ...config, registers: [embedRegistry] });
}

function safeRegisterGauge(
  config: client.GaugeConfiguration<string>
): client.Gauge<string> {
  const existing = embedRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Gauge<string>;
  }
  return new client.Gauge({ ...config, registers: [embedRegistry] });
}

function safeRegisterHistogram(
  config: client.HistogramConfiguration<string>
): client.Histogram<string> {
  const existing = embedRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Histogram<string>;
  }
  return new client.Histogram({ ...config, registers: [embedRegistry] });
}

// Queue metrics
export const embedQueueLength = safeRegisterGauge({
  name: "embed_queue_length",
  help: "Current number of requests in the embedding queue",
});

export const embedQueueCapacity = safeRegisterGauge({
  name: "embed_queue_capacity",
  help: "Maximum queue capacity",
});

export const embedRequestsQueued = safeRegisterCounter({
  name: "embed_requests_queued_total",
  help: "Total number of embedding requests queued",
});

export const embedRequestsProcessed = safeRegisterCounter({
  name: "embed_requests_processed_total",
  help: "Total number of embedding requests successfully processed",
});

export const embedRequestsDropped = safeRegisterCounter({
  name: "embed_requests_dropped_total",
  help: "Total number of embedding requests dropped (timeout, queue full, error)",
  labelNames: ["reason"],
});

export const embedRetries = safeRegisterCounter({
  name: "embed_retries_total",
  help: "Total number of batch processing retries",
});

// Batch metrics
export const embedBatchesProcessed = safeRegisterCounter({
  name: "embed_batches_processed_total",
  help: "Total number of batches processed",
});

export const embedBatchSize = safeRegisterHistogram({
  name: "embed_batch_size",
  help: "Distribution of batch sizes (number of requests per batch)",
  buckets: [1, 2, 4, 8, 16, 32, 64],
});

export const embedTextsPerBatch = safeRegisterHistogram({
  name: "embed_texts_per_batch",
  help: "Distribution of texts per batch",
  buckets: [1, 2, 4, 8, 16, 32, 64, 128],
});

// Latency metrics
export const embedQueueWaitMs = safeRegisterHistogram({
  name: "embed_queue_wait_ms",
  help: "Time requests spend waiting in queue (milliseconds)",
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000],
});

export const embedProcessingMs = safeRegisterHistogram({
  name: "embed_processing_ms",
  help: "Time to process a batch (milliseconds)",
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000],
});

// Worker metrics
export const embedWorkersActive = safeRegisterGauge({
  name: "embed_workers_active",
  help: "Number of active (healthy) embedding workers",
});

export const embedWorkersBusy = safeRegisterGauge({
  name: "embed_workers_busy",
  help: "Number of busy embedding workers",
});

export const embedWorkersError = safeRegisterGauge({
  name: "embed_workers_error",
  help: "Number of workers in error state",
});

/**
 * Update queue metrics from stats
 */
export function updateQueueMetrics(
  stats: QueueStats,
  maxQueueSize: number
): void {
  embedQueueLength.set(stats.queueLength);
  embedQueueCapacity.set(maxQueueSize);
}

/**
 * Record a batch processing event
 */
export function recordBatch(
  requestCount: number,
  textCount: number,
  processingMs: number,
  avgQueueWaitMs: number
): void {
  embedBatchesProcessed.inc();
  embedBatchSize.observe(requestCount);
  embedTextsPerBatch.observe(textCount);
  embedProcessingMs.observe(processingMs);
  if (avgQueueWaitMs > 0) {
    embedQueueWaitMs.observe(avgQueueWaitMs);
  }
}

/**
 * Update worker metrics
 */
export function updateWorkerMetrics(
  workers: { status: "idle" | "busy" | "error" | "terminated" }[]
): void {
  let active = 0;
  let busy = 0;
  let error = 0;

  for (const w of workers) {
    if (w.status === "idle" || w.status === "busy") {
      active++;
    }
    if (w.status === "busy") {
      busy++;
    }
    if (w.status === "error") {
      error++;
    }
  }

  embedWorkersActive.set(active);
  embedWorkersBusy.set(busy);
  embedWorkersError.set(error);
}

/**
 * Get the embed metrics registry (for /api/metrics endpoint)
 */
export function getEmbedMetricsRegistry() {
  return embedRegistry;
}
