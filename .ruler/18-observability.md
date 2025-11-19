# Observability

## Core Principle

Measure everything, log selectively, expose metrics consistently. Observability enables debugging, performance optimization, and reliability improvements.

## Rules

1. **Metrics registration.** Register all metrics in `packages/api/src/metrics.ts`:
   ```typescript
   export const myMetric = new client.Counter({
     name: "my_metric_total",
     help: "Description",
     labelNames: ["label1", "label2"] as const,
     registers: [metricsRegistry],
   });
   ```

2. **Structured logging.** Use structured logs (JSON) for errors, security events, and performance anomalies:
   ```typescript
   logger.error("workflow_failed", {
     runId,
     workflowId,
     error: error.message,
     duration: durationMs,
   });
   ```

3. **Log redaction.** Never log passwords, tokens, API keys, PII, or full request/response bodies.

4. **Performance budgets.** Instrument hot paths with histogram metrics:
   ```typescript
   const stopTimer = operationDuration.startTimer();
   try {
     await operation();
   } finally {
     stopTimer({ status: "ok" });
   }
   ```

## Metrics Naming

- Counters: `*_total` suffix
- Histograms: `*_duration_seconds` or `*_bytes`
- Gauges: `*_current` or `*_active`
- Labels: snake_case, lowercase

See `packages/runtime/src/metrics.ts` and `packages/api/src/metrics.ts` for examples.
