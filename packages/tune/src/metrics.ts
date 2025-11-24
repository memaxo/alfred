import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

type CounterConfig = client.CounterConfiguration<string>;
type HistogramConfig = client.HistogramConfiguration<string>;

const ensureCounter = (config: CounterConfig) => {
  const existing = metricsRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Counter<string>;
  }
  return new client.Counter(config);
};

const ensureHistogram = (config: HistogramConfig) => {
  const existing = metricsRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Histogram<string>;
  }
  return new client.Histogram(config);
};

export const fineTuneRunsTotal = ensureCounter({
  name: "tune_runs_total",
  help: "Count of fine-tune runs grouped by backend and status.",
  labelNames: ["backend", "status"] as const,
  registers: [metricsRegistry],
});

export const fineTuneRunDurationSeconds = ensureHistogram({
  name: "tune_run_duration_seconds",
  help: "Duration of fine-tune runs in seconds grouped by backend and status.",
  labelNames: ["backend", "status"] as const,
  buckets: [30, 60, 120, 300, 600, 1200, 2400, 4800],
  registers: [metricsRegistry],
});

export const fineTuneTokensTotal = ensureCounter({
  name: "tune_tokens_total",
  help: "Total tokens processed by fine-tune runs grouped by backend.",
  labelNames: ["backend"] as const,
  registers: [metricsRegistry],
});

export const fineTuneSamplesTotal = ensureCounter({
  name: "tune_samples_total",
  help: "Total dataset samples processed by fine-tune runs grouped by backend.",
  labelNames: ["backend"] as const,
  registers: [metricsRegistry],
});
