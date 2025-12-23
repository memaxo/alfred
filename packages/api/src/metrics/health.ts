import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const healthChecksTotal = new client.Counter({
  name: "health_checks_total",
  help: "Count of health check invocations by target and status.",
  labelNames: ["target", "status"] as const,
  registers: [metricsRegistry],
});
