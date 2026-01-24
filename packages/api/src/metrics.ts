/**
 * Metrics Aggregator
 *
 * This module re-exports metrics from domain packages and provides
 * centralized lazy hook wiring for cross-package metric registration.
 */

import { logger } from "@alfred/logger";
import { metricsRegistry } from "@alfred/metrics/registry";
import "@alfred/metrics/classification";

export { metricsRegistry };

// Registry deduplication patch (prevents double-registration in hot reload)
const metricsRegistryPatchKey = Symbol.for("alfred.metrics.registry.dedupe");
if (
  !(globalThis as Record<string | symbol, unknown>)[metricsRegistryPatchKey]
) {
  const originalRegisterMetric =
    metricsRegistry.registerMetric.bind(metricsRegistry);
  const patchedRegisterMetric: typeof metricsRegistry.registerMetric = (
    metric
  ) => {
    // @ts-expect-error - prom-client metric types don't expose .name property safely
    const metricWithName = metric as { name: string };
    const existing = metricsRegistry.getSingleMetric(metricWithName.name);
    if (existing && existing !== metric) {
      metricsRegistry.removeSingleMetric(metricWithName.name);
    }
    return originalRegisterMetric(metric);
  };
  metricsRegistry.registerMetric = patchedRegisterMetric;
  (globalThis as Record<string | symbol, unknown>)[metricsRegistryPatchKey] =
    true;
}

export {
  codexErrorsTotal,
  codexExecDurationSeconds,
  codexExecRunsTotal,
  codexLinearActivitiesDroppedTotal,
  codexLinearActivitiesEmittedTotal,
  codexLinearActivityBatchesTotal,
  codexLinearIntegrationLatencySeconds,
  codexSessionContinuityTotal,
  codexSessionValidationDurationSeconds,
} from "@alfred/agent/orchestrator/tool/codex/metrics";
// Tool metrics
export {
  droidExecDurationSeconds,
  droidExecRunsTotal,
  droidPendingCleanupTotal,
  droidPendingRunsGauge,
} from "@alfred/agent/orchestrator/tool/droid/metrics";
export * from "@alfred/agent/workflow/metrics";
export * from "@alfred/db";
export {
  graphContextDurationSeconds,
  graphQueriesTotal,
  graphQueryDurationSeconds,
  graphRagEmptyTotal,
  graphRagHitsTotal,
} from "@alfred/db/metrics";
// Embedding metrics (queue, pool, batch processing)
export {
  embedBatchesProcessed,
  embedBatchSize,
  embedProcessingMs,
  embedQueueCapacity,
  embedQueueLength,
  embedQueueWaitMs,
  embedRequestsDropped,
  embedRequestsProcessed,
  embedRequestsQueued,
  embedRetries,
  embedWorkersActive,
  embedWorkersBusy,
  embedWorkersError,
  getEmbedMetricsRegistry,
} from "@alfred/embed";
export * from "@alfred/history";
export {
  historyContextTierDropsTotal,
  historyContextTokensTotal,
} from "@alfred/history";
export * from "@alfred/knowledge/metrics";
// Re-export shared metrics
export {
  codexSessionValidationTimeoutTotal,
  cognitiveEntropyEventsTotal,
  cognitiveFeedbackSubmissionsTotal,
  cognitivePhysiologyGauge,
  decompositionTruncatedTotal,
  entityLinkingDurationMs,
  entityLinkingFallbackTotal,
  linearRateLimitRetryAfterTotal,
  linearRateLimitTotal,
  linearRateLimitWaitSeconds,
  memoryMaintenanceDurationSeconds,
  memoryNodesCleanedTotal,
  memoryNodesDecayedTotal,
  memoryNodesPrunedTotal,
  redisConnectionErrorsTotal,
  redisConnectionStatus,
  redisReconnectionAttemptsTotal,
} from "@alfred/metrics/shared";
export * from "@alfred/policy";
// Policy metrics are used by API request paths and must not be resolved via
// star-export ambiguity during SSR bundling.
export {
  pdpCacheHitsTotal,
  policyCheckFailuresTotal,
  policyDecisionsTotal,
  policyObligationsTotal,
  recordCacheHit,
} from "@alfred/policy";
export * from "@alfred/runtime/metrics";
// Runtime metrics used by API/adapter code must be explicitly re-exported to
// avoid ambiguous star-export resolution during SSR bundling.
export { runtimeHistorySelectionDurationSeconds } from "@alfred/runtime/metrics";
// Re-export from domain packages
export {
  fineTuneRunDurationSeconds,
  fineTuneRunsTotal,
  fineTuneSamplesTotal,
  fineTuneTokensTotal,
} from "@alfred/tune";
export * from "@alfred/voice/metrics";
// Voice WebSocket metrics are consumed by @alfred/api/voice/streaming and must be
// exported deterministically (avoid star-export ambiguity across multiple domains).
export {
  voiceWebSocketBackpressureEventsTotal,
  voiceWebSocketBinaryChunkSizeBytes,
  voiceWebSocketConnectionRejectedTotal,
  voiceWebSocketConnectionsCurrent,
  voiceWebSocketMessageLatencySeconds,
  voiceWebSocketPayloadTooLargeTotal,
  voiceWebSocketPingTimeoutTotal,
  voiceWebSocketSendFailuresTotal,
  voiceWebSocketUpgradeDurationSeconds,
  voiceWebSocketUpgradeRateLimitHitsTotal,
} from "@alfred/voice/metrics";
// API-local metrics
export * from "./metrics/index";

// Assistant metrics
import client from "prom-client";

export const assistantToolCallsTotal = new client.Counter({
  help: "Count of assistant tool invocations grouped by tool name.",
  labelNames: ["tool"] as const,
  name: "assistant_tool_calls_total",
  registers: [metricsRegistry],
});

export const assistantEscalationsTotal = new client.Counter({
  help: "Count of assistant escalations grouped by kind.",
  labelNames: ["kind"] as const,
  name: "assistant_escalations_total",
  registers: [metricsRegistry],
});

export const assistantGenerateDurationSeconds = new client.Histogram({
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  help: "Duration of assistant generation in seconds.",
  name: "assistant_generate_duration_seconds",
  registers: [metricsRegistry],
});

export const assistantGenerateRequestsTotal = new client.Counter({
  help: "Total number of assistant generation requests.",
  name: "assistant_generate_requests_total",
  registers: [metricsRegistry],
});

let metricsHooksStarted = false;

/**
 * Initialize cross-package metrics hooks.
 *
 * IMPORTANT: must not run at module import time (router imports must be
 * side-effect free so short scripts can exit).
 */
export function initMetricsHooks(): void {
  if (metricsHooksStarted) {
    return;
  }
  metricsHooksStarted = true;
  if (process.env.DISABLE_METRICS_HOOKS === "1") {
    return;
  }

  void (async () => {
    try {
      const agent = await import("@alfred/agent");
      const { droidExecRunsTotal, droidExecDurationSeconds } =
        await import("@alfred/agent/orchestrator/tool/droid/metrics");
      const {
        codexExecRunsTotal,
        codexExecDurationSeconds,
        codexErrorsTotal,
        codexSessionValidationDurationSeconds,
      } = await import("@alfred/agent/orchestrator/tool/codex/metrics");
      const {
        evalRunsTotal,
        evalDurationSeconds,
        evalScoresTotal,
        evalFailuresTotal,
        laminarEvalDatapointsTotal,
        laminarEvalErrorsTotal,
      } = await import("@alfred/agent/eval/metrics");
      const {
        compressionCyclesTotal,
        compressionCycleDurationSeconds,
        compressionNodesUpdatedTotal,
      } = await import("@alfred/runtime/metrics");

      agent.registerDroidExecCounter?.(droidExecRunsTotal);
      agent.registerDroidExecHistogram?.(droidExecDurationSeconds);
      agent.registerCodexExecCounter?.(codexExecRunsTotal);
      agent.registerCodexExecHistogram?.(codexExecDurationSeconds);
      agent.registerCodexErrorCounter?.(codexErrorsTotal);
      agent.registerCodexSessionValidationHistogram?.({
        startTimer:
          () =>
          ({ outcome }: { outcome: string }) =>
            codexSessionValidationDurationSeconds.startTimer()({ outcome }),
      });
      agent.registerEvalRunsCounter?.(evalRunsTotal);
      agent.registerEvalDurationHistogram?.(evalDurationSeconds);
      agent.registerEvalScoreCounter?.(evalScoresTotal);
      agent.registerEvalFailureCounter?.(evalFailuresTotal);
      agent.registerLaminarDatapointCounter?.(laminarEvalDatapointsTotal);
      agent.registerLaminarErrorCounter?.(laminarEvalErrorsTotal);
      agent.registerCompressionCycleCounter?.(compressionCyclesTotal);
      agent.registerCompressionCycleHistogram?.(
        compressionCycleDurationSeconds
      );
      agent.registerCompressionNodeCounter?.(compressionNodesUpdatedTotal);
      agent.registerAssistantToolCounter?.(assistantToolCallsTotal);
      agent.registerAssistantEscalationCounter?.(assistantEscalationsTotal);
    } catch (error) {
      logger.warn("metrics_agent_hooks_disabled", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    // Wire classification metrics to @alfred/knowledge
    try {
      const { registerClassificationMetrics } =
        await import("@alfred/knowledge/lexicon/domains");
      const {
        classificationSourceTotal,
        domainCacheHitsTotal,
        classificationDurationSeconds,
      } = await import("@alfred/knowledge/metrics");
      registerClassificationMetrics({
        recordCacheHit: (hit: boolean) => {
          domainCacheHitsTotal.inc({ result: hit ? "hit" : "miss" });
        },
        recordDuration: (method: "sync" | "async", durationMs: number) => {
          classificationDurationSeconds.observe({ method }, durationMs / 1000);
        },
        recordSource: (
          domain: string,
          source: "learned" | "static" | "seed"
        ) => {
          classificationSourceTotal.inc({ domain, source });
        },
      });
    } catch (error) {
      logger.warn("metrics_classification_hooks_disabled", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const policy = await import("@alfred/policy");
      const { pdpCacheHitsTotal } = await import("@alfred/policy");
      policy.registerCacheObs?.((result: string) => {
        try {
          pdpCacheHitsTotal.inc({ result });
        } catch (error) {
          logger.warn("metrics_cache_hit_failed", {
            error: error instanceof Error ? error.message : String(error),
            result,
          });
        }
      });
    } catch (error) {
      logger.warn("metrics_policy_hooks_disabled", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    // Register embed metrics with main registry
    try {
      const { getEmbedMetricsRegistry } = await import("@alfred/embed");
      const embedRegistry = getEmbedMetricsRegistry();
      // Merge embed metrics into main registry
      const embedMetrics = await embedRegistry.getMetricsAsJSON();
      for (const metric of embedMetrics) {
        const existing = metricsRegistry.getSingleMetric(metric.name);
        if (!existing) {
          // Re-register the metric from embed registry to main registry
          const embedMetric = embedRegistry.getSingleMetric(metric.name);
          if (embedMetric) {
            metricsRegistry.registerMetric(embedMetric);
          }
        }
      }
    } catch (error) {
      logger.warn("metrics_embed_hooks_disabled", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    // Register history tracking metrics with main registry
    try {
      const { getTrackingRegistry } = await import("@alfred/history");
      const trackingRegistry = getTrackingRegistry();
      // Merge tracking metrics into main registry
      const trackingMetrics = await trackingRegistry.getMetricsAsJSON();
      for (const metric of trackingMetrics) {
        const existing = metricsRegistry.getSingleMetric(metric.name);
        if (!existing) {
          // Re-register the metric from tracking registry to main registry
          const trackingMetric = trackingRegistry.getSingleMetric(metric.name);
          if (trackingMetric) {
            metricsRegistry.registerMetric(trackingMetric);
          }
        }
      }
    } catch (error) {
      logger.warn("metrics_tracking_hooks_disabled", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}

export const metricsContentType = metricsRegistry.contentType;

export function getMetricsSnapshot() {
  return metricsRegistry.metrics();
}

export function getMetricsJSON() {
  return metricsRegistry.getMetricsAsJSON();
}
