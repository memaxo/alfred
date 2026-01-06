import client from "prom-client";

export const metricsRegistry = new client.Registry();

export function safeRegisterCounter(
  config: client.CounterConfiguration<string>
): client.Counter<string> {
  const existing = metricsRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Counter<string>;
  }
  return new client.Counter({ ...config, registers: [metricsRegistry] });
}

export function safeRegisterHistogram(
  config: client.HistogramConfiguration<string>
): client.Histogram<string> {
  const existing = metricsRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Histogram<string>;
  }
  return new client.Histogram({ ...config, registers: [metricsRegistry] });
}

export function safeRegisterGauge(
  config: client.GaugeConfiguration<string>
): client.Gauge<string> {
  const existing = metricsRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Gauge<string>;
  }
  return new client.Gauge({ ...config, registers: [metricsRegistry] });
}

export function safeRegisterSummary(
  config: client.SummaryConfiguration<string>
): client.Summary<string> {
  const existing = metricsRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Summary<string>;
  }
  return new client.Summary({ ...config, registers: [metricsRegistry] });
}
