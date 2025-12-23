import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const policyDecisionsTotal = new client.Counter({
  name: "policy_decisions_total",
  help: "Count of policy decisions grouped by action and decision.",
  labelNames: ["action", "decision"] as const,
  registers: [metricsRegistry],
});

export const policyObligationsTotal = new client.Counter({
  name: "policy_obligations_total",
  help: "Count of policy obligations emitted by action.",
  labelNames: ["action", "obligation"] as const,
  registers: [metricsRegistry],
});

export const pdpCacheHitsTotal = new client.Counter({
  name: "pdp_cache_hits_total",
  help: "Count of policy cache hits and misses.",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

export const policyCheckFailuresTotal = new client.Counter({
  name: "policy_check_failures_total",
  help: "Count of tool policy enforcement failures grouped by tool.",
  labelNames: ["tool"] as const,
  registers: [metricsRegistry],
});

export function recordCacheHit(result: string) {
  pdpCacheHitsTotal.inc({ result });
}
