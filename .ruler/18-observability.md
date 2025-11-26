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

2. **Domain-Local Metrics.** Define metrics within the package that owns the domain (e.g., `packages/voice/src/metrics.ts`), not in a central monolith. Export them for registration in the main application entry point to keep packages self-contained.

3. **Structured logging.** Use structured logs (JSON) for errors, security events, and performance anomalies:
   ```typescript
   logger.error("workflow_failed", {
     runId,
     workflowId,
     error: error.message,
     duration: durationMs,
   });
   ```

4. **Log redaction.** Never log passwords, tokens, API keys, PII, or full request/response bodies.

6. **Lazy loading.** Dynamically import metric definitions in consumers (`await import(...)`) if circular dependencies arise. Use `process.env` or `try/catch` guards when loading metrics in workers/tests.

7. **Metrics location.** Define metrics in `packages/api/src/metrics.ts` to avoid circular dependencies. Domain-specific metrics can live in package-local files (e.g., `packages/voice/src/metrics.ts`) but must be exported for registration in the main entry point.

## Metrics Naming

- Counters: `*_total` suffix
- Histograms: `*_duration_seconds` or `*_bytes`
- Gauges: `*_current` or `*_active`
- Labels: snake_case, lowercase

See `packages/runtime/src/metrics.ts` and `packages/api/src/metrics.ts` for examples.
