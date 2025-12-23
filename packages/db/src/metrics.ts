import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const graphQueriesTotal = new client.Counter({
  name: "graph_queries_total",
  help: "Count of graph queries grouped by kind and resource.",
  labelNames: ["kind", "resource"] as const,
  registers: [metricsRegistry],
});

export const graphQueryDurationSeconds = new client.Histogram({
  name: "graph_query_duration_seconds",
  help: "Duration of graph queries in seconds grouped by kind.",
  labelNames: ["kind"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const graphRagHitsTotal = new client.Counter({
  name: "graph_rag_hits_total",
  help: "Count of active RAG hits grouped by source.",
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});

export const graphRagEmptyTotal = new client.Counter({
  name: "graph_rag_empty_total",
  help: "Count of active RAG queries that returned zero results.",
  registers: [metricsRegistry],
});

export const graphContextDurationSeconds = new client.Histogram({
  name: "graph_context_duration_seconds",
  help: "Duration of context graph queries (Active RAG) in seconds.",
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const dbQueryDurationSeconds = new client.Histogram({
  name: "db_query_duration_seconds",
  help: "Database query duration.",
  labelNames: ["repo", "operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const redisCommandsTotal = new client.Counter({
  name: "redis_commands_total",
  help: "Count of Redis commands executed grouped by operation.",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

export const mindscapeRagCacheEventsTotal = new client.Counter({
  name: "mindscape_rag_cache_events_total",
  help: "Count of Mindscape RAG cache events grouped by event type.",
  labelNames: ["event"] as const,
  registers: [metricsRegistry],
});
