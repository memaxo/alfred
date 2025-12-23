import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const sseConnectionsCurrent = new client.Gauge({
  name: "sse_connections_current",
  help: "Current active SSE connections.",
  labelNames: ["endpoint"] as const,
  registers: [metricsRegistry],
});

export const sseFirstChunkLatencySeconds = new client.Histogram({
  name: "sse_first_chunk_latency_seconds",
  help: "Time to first chunk in SSE streams.",
  labelNames: ["endpoint"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const sseConnectionRateLimitHitsTotal = new client.Counter({
  name: "sse_connection_rate_limit_hits_total",
  help: "SSE connection rate limit hits.",
  labelNames: ["endpoint", "reason"] as const,
  registers: [metricsRegistry],
});
