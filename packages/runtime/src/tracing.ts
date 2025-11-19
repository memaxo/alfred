/**
 * Distributed Tracing Support
 * 
 * Provides lightweight tracing for workflow runtime execution.
 * Tracks span hierarchies with nanosecond precision.
 */

import { nowNs } from "@alfred/metrics/performance";

/**
 * Trace span representing a single operation
 */
export type TraceSpan = {
  id: string;
  name: string;
  startNs: bigint;
  endNs?: bigint;
  parent?: string;
  tags: Record<string, string | number>;
};

/**
 * RuntimeTracer manages trace spans for a workflow execution
 * 
 * Usage:
 * ```typescript
 * const tracer = new RuntimeTracer(runId);
 * 
 * const spanId = tracer.startSpan("context_build");
 * // ... do work ...
 * tracer.endSpan(spanId, { cached: "false", tokens: 1234 });
 * 
 * const spans = tracer.getSpans();
 * ```
 */
export class RuntimeTracer {
  private spans: Map<string, TraceSpan> = new Map();
  private runId: string;
  private spanCounter = 0;

  constructor(runId: string) {
    this.runId = runId;
  }

  /**
   * Start a new trace span
   * 
   * @param name Span name (e.g., "context_build", "phase_plan")
   * @param parent Parent span ID for hierarchical tracing
   * @returns Span ID to use when ending the span
   */
  startSpan(name: string, parent?: string): string {
    const id = `${this.runId}-span-${this.spanCounter++}`;
    
    this.spans.set(id, {
      id,
      name,
      startNs: nowNs(),
      parent,
      tags: {},
    });
    
    return id;
  }

  /**
   * End a trace span
   * 
   * @param id Span ID returned from startSpan()
   * @param tags Optional tags to attach to the span
   */
  endSpan(id: string, tags?: Record<string, string | number>): void {
    const span = this.spans.get(id);
    if (span) {
      span.endNs = nowNs();
      if (tags) {
        span.tags = { ...span.tags, ...tags };
      }
    }
  }

  /**
   * Get all spans for this trace
   * 
   * Returns spans in chronological order (by start time)
   */
  getSpans(): TraceSpan[] {
    const spans = Array.from(this.spans.values());
    return spans.sort((a, b) => Number(a.startNs - b.startNs));
  }

  /**
   * Get span duration in milliseconds
   * 
   * @param id Span ID
   * @returns Duration in milliseconds, or null if span not found/completed
   */
  getSpanDuration(id: string): number | null {
    const span = this.spans.get(id);
    if (!span || !span.endNs) {
      return null;
    }
    return Number(span.endNs - span.startNs) / 1_000_000;
  }

  /**
   * Get total trace duration in milliseconds
   * 
   * Returns duration from first span start to last span end
   */
  getTotalDuration(): number | null {
    const spans = this.getSpans();
    if (spans.length === 0) {
      return null;
    }

    const first = spans[0];
    const last = spans[spans.length - 1];

    if (!first || !last || last.endNs === undefined) {
      return null;
    }

    return Number(last.endNs - first.startNs) / 1_000_000;
  }

  /**
   * Clear all spans (for testing)
   */
  clear(): void {
    this.spans.clear();
    this.spanCounter = 0;
  }

  /**
   * Get number of recorded spans
   */
  getSpanCount(): number {
    return this.spans.size;
  }

  /**
   * Export trace as JSON for external systems (e.g., Jaeger, Zipkin)
   */
  toJSON(): string {
    return JSON.stringify({
      traceId: this.runId,
      spans: this.getSpans().map((span) => ({
        spanId: span.id,
        operationName: span.name,
        startTimeNs: span.startNs.toString(),
        durationNs: span.endNs
          ? (span.endNs - span.startNs).toString()
          : undefined,
        parentSpanId: span.parent,
        tags: span.tags,
      })),
    });
  }
}
