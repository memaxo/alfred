# Observability Standards

## Core Principle

Measure everything, log selectively, expose metrics consistently. Observability enables debugging, performance optimization, and reliability improvements.

## Rules

1. **Metrics over logs.** Use Prometheus metrics for:
   - Request counts and durations
   - Error rates
   - Business events (workflow starts, tool calls)
   - Resource usage

2. **Structured logging.** Use structured logs (JSON) for:
   - Errors requiring investigation
   - Security events
   - Performance anomalies
   - Debug information (dev only)

3. **No console.* in production.** Replace `console.log/error/warn` with:
   - Metrics for events
   - Structured logging for errors
   - Remove debug console calls

4. **Log levels.** Use appropriate levels:
   - `error` - Failures requiring attention
   - `warn` - Recoverable issues
   - `info` - Important state changes (sparse)
   - `debug` - Development only

5. **Log redaction.** Never log:
   - Passwords, tokens, API keys
   - PII (emails, addresses) without consent
   - Full request/response bodies (log summaries)

6. **Metrics registration.** Register all metrics in `packages/api/src/metrics.ts`:
   ```typescript
   export const myMetric = new client.Counter({
     name: "my_metric_total",
     help: "Description",
     labelNames: ["label1", "label2"] as const,
     registers: [metricsRegistry],
   });
   ```

7. **Error tracking.** Integrate error tracking (e.g., Sentry) for:
   - Unhandled exceptions
   - tRPC errors (via middleware)
   - React error boundaries

8. **Performance budgets.** Instrument hot paths:
   ```typescript
   const stopTimer = operationDuration.startTimer();
   try {
     await operation();
   } finally {
     stopTimer({ status: "ok" });
   }
   ```

## Logging Format

```typescript
// ✅ Structured logging
logger.error("workflow_failed", {
  runId,
  workflowId,
  error: error.message,
  duration: durationMs,
});

// ❌ Unstructured
console.error(`Workflow ${runId} failed: ${error.message}`);
```

## Metrics Naming

- Counters: `*_total` suffix
- Histograms: `*_duration_seconds` or `*_bytes`
- Gauges: `*_current` or `*_active`
- Labels: snake_case, lowercase

## Examples

```typescript
// ✅ Metrics for events
workflowStreamEventsTotal.inc({ event: "run" });

// ✅ Structured error logging
catch (error) {
  logger.error("workflow_persistence_failed", {
    runId,
    error: error.message,
  });
  // Continue without throwing
}

// ❌ Console in production
console.error(`Failed: ${error}`);
```

