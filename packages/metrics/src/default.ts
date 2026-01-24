import client from "prom-client";

import { metricsRegistry } from "./registry";

const startedKey = Symbol.for("alfred.metrics.default.started");

export function startDefaultMetrics(): void {
  const g = globalThis as Record<string | symbol, unknown>;
  if (g[startedKey]) {
    return;
  }
  g[startedKey] = true;
  client.collectDefaultMetrics({ register: metricsRegistry });
}
