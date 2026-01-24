import {
  safeRegisterHistogram,
  safeRegisterCounter,
  safeRegisterGauge,
} from "@alfred/metrics/registry";

// Index build timing
export const indexBuildDuration = safeRegisterHistogram({
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  help: "Time to build codeprint index",
  name: "codeprint_index_build_duration_seconds",
});

// Query latency by method
export const queryDuration = safeRegisterHistogram({
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  help: "Query latency",
  labelNames: ["method", "cache_hit"],
  name: "codeprint_query_duration_seconds",
});

// Query counter
export const queriesTotal = safeRegisterCounter({
  help: "Total queries",
  labelNames: ["method", "cache_hit"],
  name: "codeprint_queries_total",
});

// Parse errors
export const parseErrorsTotal = safeRegisterCounter({
  help: "Files that failed to parse",
  name: "codeprint_parse_errors_total",
});

// Rerank fallbacks
export const rerankFallbacksTotal = safeRegisterCounter({
  help: "Times rerank failed and fell back to keyword-only",
  name: "codeprint_rerank_fallbacks_total",
});

// Index size gauge
export const indexSizeGauge = safeRegisterGauge({
  help: "Number of files in index",
  name: "codeprint_index_size_files",
});

// Cache age gauge
export const cacheAgeGauge = safeRegisterGauge({
  help: "Age of cached index",
  name: "codeprint_cache_age_seconds",
});

// Keyword match stats
export const keywordCandidatesHistogram = safeRegisterHistogram({
  buckets: [0, 5, 10, 25, 50, 100, 250, 500],
  help: "Number of candidates from keyword matching",
  name: "codeprint_keyword_candidates",
});

// Rerank score improvement
export const rerankScoreShift = safeRegisterHistogram({
  buckets: [-0.5, -0.25, 0, 0.25, 0.5, 0.75, 1],
  help: "Score change from reranking (positive = rerank improved ranking)",
  name: "codeprint_rerank_score_shift",
});
