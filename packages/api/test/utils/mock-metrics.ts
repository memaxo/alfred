import { mock, vi } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
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
const exportStarRegex = /export\s*\*\s*from\s*["']([^"']+)["']/g;
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

// Include exports from API-local metrics modules (`src/metrics/*.ts`).
// These are re-exported via `export * from "./metrics/index"` in the aggregator,
// but the aggregator only contains export-star statements, so we collect the
// leaf exports directly to keep the stub complete.
try {
  const metricsDir = join(import.meta.dir, "../../src/metrics");
  for (const file of readdirSync(metricsDir)) {
    if (!file.endsWith(".ts")) {
      continue;
    }
    const source = readFileSync(join(metricsDir, file), "utf8");
    for (const match of source.matchAll(exportConstRegex)) {
      const name = match[1];
      if (!name) {
        continue;
      }
      if (!metricsStub[name]) {
        metricsStub[name] = createMetricStub();
      }
    }
  }
} catch {
  // Best-effort: tests can still run with partial stubs.
}

// Handle `export * from "@alfred/*/metrics"` style re-exports.
// We only hydrate stubs for `*/metrics` modules to avoid importing heavy non-metrics modules.
for (const match of metricsSource.matchAll(exportStarRegex)) {
  const spec = match[1]?.trim();
  if (!spec) {
    continue;
  }
  if (!spec.endsWith("/metrics")) {
    continue;
  }
  if (spec === "@alfred/agent/workflow/metrics") {
    continue;
  }

  try {
    const mod = await import(spec);
    for (const [name, value] of Object.entries(mod)) {
      if (name === "default") {
        continue;
      }
      if (metricsStub[name]) {
        continue;
      }
      if (typeof value === "function") {
        metricsStub[name] = vi.fn();
        continue;
      }
      metricsStub[name] = createMetricStub();
    }
  } catch {
    // Best-effort: if the module isn't available, skip it.
  }
}

metricsStub.metricsRegistry = {};
metricsStub.recordVoiceStt = vi.fn();
metricsStub.recordVoiceTts = vi.fn();
metricsStub.recordStreamEvent = vi.fn();
metricsStub.startStreamTimer = vi.fn(() => vi.fn());
metricsStub.getMetricsSnapshot = vi.fn(() => "metrics");
metricsStub.getMetricsJSON = vi.fn(() => []);
metricsStub.initMetricsHooks = vi.fn();

// Workflow runner metrics commonly needed by workflow tests
metricsStub.runnerStepsTotal = createMetricStub();
metricsStub.runnerErrorsTotal = createMetricStub();

// Policy metrics are imported by `requirePolicy()` via @alfred/api/metrics.
metricsStub.policyDecisionsTotal = createMetricStub();
metricsStub.policyObligationsTotal = createMetricStub();
metricsStub.pdpCacheHitsTotal = createMetricStub();
metricsStub.policyCheckFailuresTotal = createMetricStub();

export { metricsStub, createMetricStub };

function applyMockMetrics(): void {
  mock.module("@alfred/api/metrics", () => ({
    ...metricsStub,
  }));

  // Some modules import via source path; mock that too.
  mock.module("@alfred/api/src/metrics", () => ({
    ...metricsStub,
  }));
}

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
      await Promise.resolve();
      yield { type: "finish", finishReason: "stop" };
    })(),
  })),
} as const;

function applyMockAi(): void {
  mock.module("ai", () => aiStub);
}

// Policy hooks used by metrics: provide default no-op implementations.
const defaultPolicyEvaluate = vi
  .fn()
  .mockResolvedValue({ allow: true, obligations: [] as Obligation[] });
const defaultRegisterCacheObs = vi.fn();

export const policyStub = {
  evaluate: defaultPolicyEvaluate,
  registerCacheObs: defaultRegisterCacheObs,
  // Policy metrics are imported indirectly via @alfred/api/metrics re-exports.
  policyDecisionsTotal: createMetricStub(),
  policyObligationsTotal: createMetricStub(),
  pdpCacheHitsTotal: createMetricStub(),
  policyCheckFailuresTotal: createMetricStub(),
  recordCacheHit: vi.fn(),
} as const;

function applyMockPolicy(): void {
  mock.module("@alfred/policy", () => ({
    ...policyStub,
  }));
}

// Logger mock - commonly needed across all test files
export const loggerStub = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function applyMockLogger(): void {
  mock.module("@alfred/logger", () => ({
    logger: loggerStub,
  }));
}

// Workflow metrics from @alfred/agent - needed by workflow runner tests
// Include all metrics that are re-exported from @alfred/api/metrics
const workflowMetricsStub = {
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
} as const;

function applyMockWorkflowMetrics(): void {
  mock.module("@alfred/agent/workflow/metrics", () => workflowMetricsStub);
}

function applyAllModuleMocks(): void {
  applyMockMetrics();
  applyMockAi();
  applyMockPolicy();
  applyMockLogger();
  applyMockWorkflowMetrics();
}

applyAllModuleMocks();

// Allow the shared test preload to re-apply baseline module mocks between tests.
(
  globalThis as unknown as {
    __alfredRegisterModuleResetter?: (fn: () => void) => void;
  }
).__alfredRegisterModuleResetter?.(applyAllModuleMocks);
