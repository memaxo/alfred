import { mock, vi } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Obligation } from "@alfred/type";

const createMetricStub = () => ({
  inc: vi.fn(),
  dec: vi.fn(),
  observe: vi.fn(),
  set: vi.fn(),
  labels: vi.fn(() => createMetricStub()),
  startTimer: vi.fn(() => vi.fn()),
});

const metricsSource = readFileSync(
  join(import.meta.dir, "../../src/metrics.ts"),
  "utf8"
);

const apiMetricsExtraSources = (() => {
  const files = [
    new URL("../../src/metrics/trpc.ts", import.meta.url),
    new URL("../../src/metrics/health.ts", import.meta.url),
    new URL("../../src/metrics/sse.ts", import.meta.url),
    new URL("../../src/metrics/webhook.ts", import.meta.url),
    new URL("../../src/metrics/preference.ts", import.meta.url),
  ];
  const sources: string[] = [];
  for (const file of files) {
    try {
      sources.push(readFileSync(file, "utf8"));
    } catch {
      // Ignore missing files; the suite can still run with partial stubs.
    }
  }
  return sources;
})();

const dbMetricsSource = (() => {
  try {
    return readFileSync(
      new URL("../../../../db/src/metrics.ts", import.meta.url),
      "utf8"
    );
  } catch {
    return null;
  }
})();

const runtimeMetricsSource = (() => {
  try {
    return readFileSync(
      new URL("../../../../runtime/src/metrics.ts", import.meta.url),
      "utf8"
    );
  } catch {
    return null;
  }
})();

const voiceMetricsSource = (() => {
  try {
    return readFileSync(
      new URL("../../../../voice/src/metrics.ts", import.meta.url),
      "utf8"
    );
  } catch {
    return null;
  }
})();

const exportConstRegex = /export const (\w+)/g;
// Also match re-exports: export { name1, name2 } from "..."
const reExportRegex = /export\s*\{\s*([^}]+)\s*\}/g;
const metricsStub: Record<string, unknown> = {};

for (const match of metricsSource.matchAll(exportConstRegex)) {
  const name = match[1];
  if (name === "metricsContentType") {
    metricsStub[name] = "text/plain";
    continue;
  }
  metricsStub[name] = createMetricStub();
}

// API-local metrics are re-exported via `export * from "./metrics/index"`.
for (const source of apiMetricsExtraSources) {
  for (const match of source.matchAll(exportConstRegex)) {
    const name = match[1];
    if (!name) {
      continue;
    }
    metricsStub[name] ??= createMetricStub();
  }
}

// DB metrics are re-exported via `export * from "@alfred/db"` in
// `packages/api/src/metrics.ts`, but the export parser doesn't follow star exports.
if (dbMetricsSource) {
  for (const match of dbMetricsSource.matchAll(exportConstRegex)) {
    const name = match[1];
    if (!name) {
      continue;
    }
    metricsStub[name] ??= createMetricStub();
  }
}

// Runtime metrics are re-exported via `export * from "@alfred/runtime/metrics"`.
if (runtimeMetricsSource) {
  for (const match of runtimeMetricsSource.matchAll(exportConstRegex)) {
    const name = match[1];
    if (!name) {
      continue;
    }
    metricsStub[name] ??= createMetricStub();
  }
}

// Voice metrics are re-exported via `export * from "@alfred/voice/metrics"`.
if (voiceMetricsSource) {
  for (const match of voiceMetricsSource.matchAll(exportConstRegex)) {
    const name = match[1];
    if (!name) {
      continue;
    }
    metricsStub[name] ??= createMetricStub();
  }
}

// Handle re-exports like: export { foo, bar, baz } from "..."
for (const match of metricsSource.matchAll(reExportRegex)) {
  const exports = match[1].split(",").map((s) => s.trim());
  for (const exp of exports) {
    // Handle "name as alias" syntax
    const namePart = exp.split(/\s+as\s+/)[0].trim();
    // Skip type exports
    if (namePart.startsWith("type ")) {
      continue;
    }
    if (namePart && !metricsStub[namePart]) {
      metricsStub[namePart] = createMetricStub();
    }
  }
}

metricsStub.metricsRegistry = {};
metricsStub.recordVoiceStt = vi.fn();
metricsStub.recordVoiceTts = vi.fn();
metricsStub.recordStreamEvent = vi.fn();
metricsStub.startStreamTimer = vi.fn(() => vi.fn());
metricsStub.getMetricsSnapshot = vi.fn(() => "metrics");

// Common DB metrics that frequently appear via `../metrics` imports.
metricsStub.graphContextDurationSeconds ??= createMetricStub();
metricsStub.graphQueriesTotal ??= createMetricStub();
metricsStub.graphQueryDurationSeconds ??= createMetricStub();
metricsStub.graphRagEmptyTotal ??= createMetricStub();
metricsStub.graphRagHitsTotal ??= createMetricStub();

// Common runtime metrics that appear in AI/history adapters.
metricsStub.runtimeHistorySelectionDurationSeconds ??= createMetricStub();
metricsStub.runtimeHistoryTokensTotal ??= createMetricStub();
metricsStub.runtimeHistoryTierDropsTotal ??= createMetricStub();
metricsStub.orchestratorGenerateRequestsTotal ??= createMetricStub();
metricsStub.orchestratorGenerateDurationSeconds ??= createMetricStub();
metricsStub.preferenceHistoryPrunedTotal ??= createMetricStub();
metricsStub.workflowObligationSuspensionsTotal ??= createMetricStub();
metricsStub.workflowObligationDurationSeconds ??= createMetricStub();
metricsStub.voiceWebSocketConnectionsCurrent ??= createMetricStub();
metricsStub.voiceWebSocketSendFailuresTotal ??= createMetricStub();
metricsStub.voiceWebSocketUpgradeRateLimitHitsTotal ??= createMetricStub();
metricsStub.voiceWebSocketConnectionRejectedTotal ??= createMetricStub();
metricsStub.voiceWebSocketMessageLatencySeconds ??= createMetricStub();
metricsStub.voiceWebSocketBinaryChunkSizeBytes ??= createMetricStub();
metricsStub.voiceWebSocketUpgradeDurationSeconds ??= createMetricStub();
metricsStub.voiceWebSocketBackpressureEventsTotal ??= createMetricStub();
metricsStub.voiceWebSocketPingTimeoutTotal ??= createMetricStub();
metricsStub.voiceWebSocketPayloadTooLargeTotal ??= createMetricStub();

// Policy metrics are re-exported via `export * from "@alfred/policy"` in
// `packages/api/src/metrics.ts` (not detectable by the simple export parser above).
metricsStub.policyDecisionsTotal ??= createMetricStub();
metricsStub.policyObligationsTotal ??= createMetricStub();

// Workflow runner metrics commonly needed by workflow tests
metricsStub.runnerStepsTotal = createMetricStub();
metricsStub.runnerErrorsTotal = createMetricStub();

export { metricsStub, createMetricStub };

mock.module("@alfred/api/metrics", () => ({
  ...metricsStub,
}));

// Some modules import via source path; mock that too.
mock.module("@alfred/api/src/metrics", () => ({
  ...metricsStub,
}));

// AI SDK is used across routers/history/runtime. Provide a stable stub so any test
// file can safely import modules that depend on `ai` without needing ad-hoc mocks.
const realAiModule = await import("ai");

export const aiStub = {
  ...realAiModule,
  validateUIMessages: vi.fn(async ({ messages }: { messages?: unknown[] }) =>
    Array.isArray(messages) ? messages : []
  ),
  generateText: vi.fn().mockResolvedValue({
    text: "",
    toolCalls: [],
    toolResults: [],
    usage: { inputTokens: 0, outputTokens: 0 },
    finishReason: "stop",
  }),
  generateObject: vi.fn().mockResolvedValue({ object: {} }),
  streamText: vi.fn(() => ({
    fullStream: (async function* () {
      yield {
        type: "finish",
        finishReason: "stop",
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    })(),
  })),
} as const;

mock.module("ai", () => aiStub);

// Policy hooks used by metrics: provide default no-op implementations.
const defaultPolicyEvaluate = vi
  .fn()
  .mockResolvedValue({ allow: true, obligations: [] as Obligation[] });
const defaultRegisterCacheObs = vi.fn();

export const policyStub = {
  evaluate: defaultPolicyEvaluate,
  registerCacheObs: defaultRegisterCacheObs,
} as const;

mock.module("@alfred/policy", () => ({
  ...policyStub,
}));

// Logger mock - commonly needed across all test files
export const loggerStub = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

mock.module("@alfred/logger", () => ({
  logger: loggerStub,
}));

// Workflow metrics from @alfred/agent - needed by workflow runner tests
// Include all metrics that are re-exported from @alfred/api/metrics
mock.module("@alfred/agent/workflow/metrics", () => ({
  __esModule: true,
  runnerStepsTotal: createMetricStub(),
  runnerErrorsTotal: createMetricStub(),
  runRegistryDispatchDurationSeconds: createMetricStub(),
  runRegistryEventsTotal: createMetricStub(),
  linearActivityDurationSeconds: createMetricStub(),
  linearActivityEmissionsTotal: createMetricStub(),
  linearSessionOperationsTotal: createMetricStub(),
  linearWebhookEventsTotal: createMetricStub(),
  linearWebhookWorkflowStartsTotal: createMetricStub(),
  linearWebhookWorkflowCancelsTotal: createMetricStub(),
  multiAgentAgentDurationSeconds: createMetricStub(),
  multiAgentErrorsTotal: createMetricStub(),
  multiAgentTasksTotal: createMetricStub(),
  multiAgentWavesTotal: createMetricStub(),
  replayQueriesTotal: createMetricStub(),
  replayQueryDurationSeconds: createMetricStub(),
  workflowProvenanceDurationSeconds: createMetricStub(),
  workflowProvenanceEdgesTotal: createMetricStub(),
  workflowStreamDurationSeconds: createMetricStub(),
  workflowStreamEventsTotal: createMetricStub(),
}));
