# Metrics Instrumentation Patterns

## Core Principle

Instruments use nanosecond precision from `process.hrtime.bigint()`. Budget enforcement surfaces when operations exceed expected latency.

## Rules

1. **Nanosecond timing.** Use `process.hrtime.bigint()` or the wrapper `nowNs()` for high-precision timing. Never use `Date.now()` or `performance.now()` for budget-critical measurements.

2. **Budget wrapper.** Use `withBudget(label, budgetMs, fn)` for hot path instrumentation. Log warnings when budget exceeded. Budget breaches are defects.

3. **Mark and measure.** Use `mark(label)` to record timestamps and `measure(startLabel, endLabel)` to calculate elapsed ms. Use for span tracking, not just totals.

4. **Voice-specific markers.** Use `markVoice(label)` with `VoiceMetricLabel` enum for STT/TTS pipeline instrumentation. Labels span capture, stream, STT, and TTS.

5. **Histogram observation.** Observe durations in seconds to Prometheus histograms: `metric.observe(labels, durationSec)`. Use seconds (not ms) for Prometheus compatibility.

6. **Domain metrics.** Define metrics in `src/cognitive.ts`, `src/default.ts`, etc. Export from `index.ts` for registration. Avoid circular dependencies.

7. **Counter increments.** Increment counters for discrete events: `counter.inc(1, labels)`. Label values must be strings or numbers.

8. **Gauge operations.** Use `gauge.set(value, labels)` for point-in-time values, `gauge.inc(delta, labels)` for deltas.

## See Also

- `.ruler/18-observability.md` for naming and registration patterns
