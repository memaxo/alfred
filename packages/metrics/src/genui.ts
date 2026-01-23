import client from "prom-client";
import { metricsRegistry } from "./registry";

export const genuiSchemaGenerationTotal = new client.Counter({
  name: "genui_schema_generation_total",
  help: "GenUI schema generation attempts grouped by path and outcome.",
  labelNames: ["path", "outcome", "component", "surface", "mode"] as const,
  registers: [metricsRegistry],
});

export const genuiSchemaGenerationDurationSeconds = new client.Histogram({
  name: "genui_schema_generation_duration_seconds",
  help: "GenUI schema generation duration in seconds.",
  labelNames: ["path", "component", "surface", "mode"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const genuiAutoEnrichmentTotal = new client.Counter({
  name: "genui_auto_enrichment_total",
  help: "GenUI auto-enrichment attempts for tool results.",
  labelNames: ["outcome", "tool_name"] as const,
  registers: [metricsRegistry],
});

export const genuiAutoEnrichmentDurationSeconds = new client.Histogram({
  name: "genui_auto_enrichment_duration_seconds",
  help: "GenUI auto-enrichment duration in seconds.",
  labelNames: ["outcome", "tool_name"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

