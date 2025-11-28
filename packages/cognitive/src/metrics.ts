import * as client from "prom-client";

const metricsRegistry = new client.Registry();

export const cognitiveTransitionDuration = new client.Histogram({
  name: "cognitive_transition_duration_seconds",
  help: "Duration of cognitive state transitions",
  labelNames: ["from_state", "to_state", "event_type"] as const,
  buckets: [0.000_01, 0.000_05, 0.0001, 0.0005, 0.001],
  registers: [metricsRegistry],
});

export const cognitivePhysiologyUpdateDuration = new client.Histogram({
  name: "cognitive_physiology_update_duration_seconds",
  help: "Duration of physiology updates",
  buckets: [0.000_001, 0.000_005, 0.000_01, 0.000_05],
  registers: [metricsRegistry],
});

export const cognitiveAutonomyUpdateDuration = new client.Histogram({
  name: "cognitive_autonomy_update_duration_seconds",
  help: "Duration of autonomy gradient updates",
  buckets: [0.000_01, 0.000_05, 0.0001, 0.0005],
  registers: [metricsRegistry],
});

export const cognitiveErrorCalculationDuration = new client.Histogram({
  name: "cognitive_error_calculation_duration_seconds",
  help: "Duration of delta/error calculations",
  buckets: [0.000_01, 0.000_05, 0.0001, 0.0005, 0.001],
  registers: [metricsRegistry],
});

export const cognitiveMetricsRegistry = metricsRegistry;
