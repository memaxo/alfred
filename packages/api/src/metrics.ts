/**
 * Metrics Aggregator
 *
 * This module re-exports metrics from domain packages and provides
 * centralized lazy hook wiring for cross-package metric registration.
 */

import { logger } from "@alfred/logger";
import { metricsRegistry } from "@alfred/metrics/registry";

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
    const existing = metricsRegistry.getSingleMetric((metric as any).name);
    if (existing && existing !== metric) {
      metricsRegistry.removeSingleMetric((metric as any).name);
    }
    return originalRegisterMetric(metric);
  };
  metricsRegistry.registerMetric = patchedRegisterMetric;
  (globalThis as Record<string | symbol, unknown>)[metricsRegistryPatchKey] =
    true;
}

// API-local metrics
export * from "./metrics/index";

// Re-export from domain packages
export {
  fineTuneRunDurationSeconds,
  fineTuneRunsTotal,
  fineTuneSamplesTotal,
  fineTuneTokensTotal,
} from "@alfred/tune";

export * from "@alfred/agent/workflow/metrics";
export * from "@alfred/db";
export {
  historyContextTierDropsTotal,
  historyContextTokensTotal,
} from "@alfred/history";
export * from "@alfred/history";
export * from "@alfred/knowledge/metrics";
export * from "@alfred/policy";
export * from "@alfred/runtime/metrics";
export * from "@alfred/voice/metrics";

// Tool metrics
export {
  droidExecRunsTotal,
  droidExecDurationSeconds,
  droidPendingCleanupTotal,
  droidPendingRunsGauge,
} from "@alfred/agent/orchestrator/tool/droid/metrics";

export {
  codexExecRunsTotal,
  codexExecDurationSeconds,
  codexErrorsTotal,
  codexSessionValidationDurationSeconds,
  codexLinearActivitiesDroppedTotal,
  codexLinearActivitiesEmittedTotal,
  codexLinearActivityBatchesTotal,
  codexLinearIntegrationLatencySeconds,
  codexSessionContinuityTotal,
} from "@alfred/agent/orchestrator/tool/codex/metrics";

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

// Assistant metrics
import client from "prom-client";

export const assistantToolCallsTotal = new client.Counter({
  name: "assistant_tool_calls_total",
  help: "Count of assistant tool invocations grouped by tool name.",
  labelNames: ["tool"] as const,
  registers: [metricsRegistry],
});

export const assistantEscalationsTotal = new client.Counter({
  name: "assistant_escalations_total",
  help: "Count of assistant escalations grouped by kind.",
  labelNames: ["kind"] as const,
  registers: [metricsRegistry],
});

export const assistantGenerateDurationSeconds = new client.Histogram({
  name: "assistant_generate_duration_seconds",
  help: "Duration of assistant generation in seconds.",
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

export const assistantGenerateRequestsTotal = new client.Counter({
  name: "assistant_generate_requests_total",
  help: "Total number of assistant generation requests.",
  registers: [metricsRegistry],
});

// Lazy hook wiring for cross-package metrics
if (process.env.DISABLE_METRICS_HOOKS !== "1") {
  (async () => {
    try {
      const agent = await import("@alfred/agent");
      const {
        droidExecRunsTotal,
        droidExecDurationSeconds,
      } = await import("@alfred/agent/orchestrator/tool/droid/metrics");
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
      agent.registerCodexErrorCounter?.(codexErrorsTotal as any);
      agent.registerCodexSessionValidationHistogram?.({
        startTimer: () => {
          const done = codexSessionValidationDurationSeconds.startTimer();
          return ({ outcome }: { outcome: string }) => done({ outcome });
        },
      } as any);
      agent.registerEvalRunsCounter?.(evalRunsTotal);
      agent.registerEvalDurationHistogram?.(evalDurationSeconds);
      agent.registerEvalScoreCounter?.(evalScoresTotal);
      agent.registerEvalFailureCounter?.(evalFailuresTotal);
      agent.registerLaminarDatapointCounter?.(laminarEvalDatapointsTotal);
      agent.registerLaminarErrorCounter?.(laminarEvalErrorsTotal);
      agent.registerCompressionCycleCounter?.(compressionCyclesTotal);
      agent.registerCompressionCycleHistogram?.({
        startTimer: () => compressionCycleDurationSeconds.startTimer(),
      } as any);
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
      const { registerClassificationMetrics } = await import(
        "@alfred/knowledge/lexicon/domains"
      );
      const {
        classificationSourceTotal,
        domainCacheHitsTotal,
        classificationDurationSeconds,
      } = await import("@alfred/knowledge/metrics");
      registerClassificationMetrics({
        recordSource: (
          domain: string,
          source: "learned" | "static" | "seed"
        ) => {
          classificationSourceTotal.inc({ domain, source });
        },
        recordCacheHit: (hit: boolean) => {
          domainCacheHitsTotal.inc({ result: hit ? "hit" : "miss" });
        },
        recordDuration: (method: "sync" | "async", durationMs: number) => {
          classificationDurationSeconds.observe({ method }, durationMs / 1000);
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
            result,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    } catch (error) {
      logger.warn("metrics_policy_hooks_disabled", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}

export const metricsContentType = metricsRegistry.contentType;

export function getMetricsSnapshot() {
  return metricsRegistry.metrics();
}
