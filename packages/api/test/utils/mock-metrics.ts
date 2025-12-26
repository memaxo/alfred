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

/**
 * The API metrics module re-exports a large set of metrics via `export * from ...`
 * (e.g. runtime, db). Bun's module mocking resolves these imports to the same
 * file path, so missing names here will crash module initialization for routers
 * that import metrics via `../metrics`.
 *
 * To keep this stub lightweight (no runtime imports), we scrape exported const
 * names from the upstream metrics source files and add metric-shaped stubs.
 */
const extraMetricSources = [
  // API-local metrics (re-exported via `./metrics/index`)
  new URL("../../src/metrics/trpc.ts", import.meta.url).pathname,
  new URL("../../src/metrics/health.ts", import.meta.url).pathname,
  new URL("../../src/metrics/sse.ts", import.meta.url).pathname,
  new URL("../../src/metrics/webhook.ts", import.meta.url).pathname,
  new URL("../../src/metrics/preference.ts", import.meta.url).pathname,
  // Runtime metrics (includes orchestrator metrics)
  new URL("../../../runtime/src/metrics.ts", import.meta.url).pathname,
  // DB metrics (includes graph metrics)
  new URL("../../../db/src/metrics.ts", import.meta.url).pathname,
  // Policy metrics (used by policy enforcement middleware)
  new URL("../../../policy/src/metrics.ts", import.meta.url).pathname,
  // Knowledge and voice expose metrics packages used by routers
  new URL("../../../knowledge/src/metrics.ts", import.meta.url).pathname,
  new URL("../../../voice/src/metrics.ts", import.meta.url).pathname,
];

for (const filePath of extraMetricSources) {
  let src: string;
  try {
    src = readFileSync(filePath, "utf8");
  } catch {
    // File may not exist in all workspace configurations; skip gracefully.
    continue;
  }
  for (const match of src.matchAll(exportConstRegex)) {
    const name = match[1];
    if (name && !metricsStub[name]) {
      metricsStub[name] = createMetricStub();
    }
  }
}

metricsStub.metricsRegistry = {};
metricsStub.recordVoiceStt = vi.fn();
metricsStub.recordVoiceTts = vi.fn();
metricsStub.recordStreamEvent = vi.fn();
metricsStub.startStreamTimer = vi.fn(() => vi.fn());
metricsStub.getMetricsSnapshot = vi.fn(() => "metrics");

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
