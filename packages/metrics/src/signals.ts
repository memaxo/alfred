import client from "prom-client";

export const signalsJudgeLatencySeconds = new client.Histogram({
  name: "signals_judge_latency_seconds",
  help: "Latency of LLM-judged signals classification.",
  labelNames: ["surface", "model"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const signalsDetectedTotal = new client.Counter({
  name: "signals_detected_total",
  help: "Count of signals detected by judge.",
  labelNames: ["surface", "kind", "type", "severity", "timing"] as const,
});

export const signalsInterventionsTotal = new client.Counter({
  name: "signals_interventions_total",
  help: "Count of interventions recommended by judge.",
  labelNames: ["surface", "action", "timing"] as const,
});
