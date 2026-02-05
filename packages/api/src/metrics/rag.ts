import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

export const ragBudgetExceededTotal = new client.Counter({
  name: "rag_budget_exceeded_total",
  help: "Count of RAG chunk drops/truncations due to budget enforcement.",
  labelNames: ["action"] as const,
  registers: [metricsRegistry],
});
