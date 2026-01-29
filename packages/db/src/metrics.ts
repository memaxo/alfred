import {
  safeRegisterCounter,
  safeRegisterHistogram,
} from "@alfred/metrics/registry";

export const graphQueriesTotal = safeRegisterCounter({
  name: "graph_queries_total",
  help: "Count of graph queries grouped by kind and resource.",
  labelNames: ["kind", "resource"] as const,
});

export const graphQueryDurationSeconds = safeRegisterHistogram({
  name: "graph_query_duration_seconds",
  help: "Duration of graph queries in seconds grouped by kind.",
  labelNames: ["kind"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

export const graphRagHitsTotal = safeRegisterCounter({
  name: "graph_rag_hits_total",
  help: "Count of active RAG hits grouped by source.",
  labelNames: ["source"] as const,
});

export const graphRagEmptyTotal = safeRegisterCounter({
  name: "graph_rag_empty_total",
  help: "Count of active RAG queries that returned zero results.",
});

export const graphContextDurationSeconds = safeRegisterHistogram({
  name: "graph_context_duration_seconds",
  help: "Duration of context graph queries (Active RAG) in seconds.",
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

export const dbQueryDurationSeconds = safeRegisterHistogram({
  name: "db_query_duration_seconds",
  help: "Database query duration.",
  labelNames: ["repo", "operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

export const redisCommandsTotal = safeRegisterCounter({
  name: "redis_commands_total",
  help: "Count of Redis commands executed grouped by operation.",
  labelNames: ["operation"] as const,
});

export const mindscapeRagCacheEventsTotal = safeRegisterCounter({
  name: "mindscape_rag_cache_events_total",
  help: "Count of Mindscape RAG cache events grouped by event type.",
  labelNames: ["event"] as const,
});

export const reviewSubmissionsTotal = safeRegisterCounter({
  name: "review_submissions_total",
  help: "Total number of review submissions by type and verdict.",
  labelNames: ["type", "verdict"] as const,
});

export const reviewSubmissionDurationSeconds = safeRegisterHistogram({
  name: "review_submission_duration_seconds",
  help: "Duration of review submission processing.",
  labelNames: ["type", "verdict"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const reviewCreationDurationSeconds = safeRegisterHistogram({
  name: "review_creation_duration_seconds",
  help: "Duration of review creation including enrichment.",
  labelNames: ["type"] as const,
  buckets: [0.05, 0.1, 0.5, 1, 2, 5, 10],
});

export const reviewSlaBreachesTotal = safeRegisterCounter({
  name: "review_sla_breaches_total",
  help: "Total number of review SLA breaches detected.",
  labelNames: ["priority", "type"] as const,
});

export const reviewSlaCheckDurationSeconds = safeRegisterHistogram({
  name: "review_sla_check_duration_seconds",
  help: "Duration of review SLA breach check cycle.",
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export async function measureQuery<T>(
  repo: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    dbQueryDurationSeconds.observe(
      { repo, operation },
      (performance.now() - start) / 1000
    );
  }
}

export async function measureGraphQuery<T>(
  kind: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    graphQueryDurationSeconds.observe(
      { kind },
      (performance.now() - start) / 1000
    );
  }
}
