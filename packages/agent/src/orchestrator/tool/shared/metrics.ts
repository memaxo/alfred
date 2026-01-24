/**
 * Shared metrics utilities for tool execution
 *
 * Provides consistent metrics recording across tools (Codex, Droid, etc.)
 * without introducing new abstractions - just wraps existing metric functions.
 */

import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

import {
  recordCodexError,
  recordCodexExecRun,
  recordDroidExecRun,
  startCodexExecTimer,
  startDroidExecTimer,
} from "../../../metrics";

/** Supported tool types for metrics */
export type MetricTool = "codex" | "droid";

/** Error stages for tool execution */
export type ToolErrorStage = "spawn" | "timeout" | "parse" | "runtime";

/**
 * Record tool execution completion
 *
 * @param tool - Tool name ("codex" or "droid")
 * @param auto - Auto level used
 * @param exitCode - Process exit code
 */
export function recordToolExecution(
  tool: MetricTool,
  auto: string,
  exitCode: number
): void {
  if (tool === "codex") {
    recordCodexExecRun(auto, exitCode);
  } else {
    recordDroidExecRun(auto, exitCode);
  }
}

/**
 * Start a duration timer for tool execution
 *
 * @param tool - Tool name ("codex" or "droid")
 * @param auto - Auto level used
 * @returns Stop function to call when execution completes
 */
export function startToolTimer(tool: MetricTool, auto: string): () => void {
  if (tool === "codex") {
    return startCodexExecTimer(auto);
  }
  return startDroidExecTimer(auto);
}

/**
 * Create a stage recorder that tracks which error stages have been recorded
 * Prevents duplicate recording of the same error stage
 *
 * @param tool - Tool name (currently only codex supports error stages)
 * @returns Function to record error stage (no-op for tools without error tracking)
 */
export function createStageRecorder(
  tool: MetricTool
): (stage: ToolErrorStage) => void {
  if (tool !== "codex") {
    // Only codex has error stage tracking currently
    return () => {};
  }

  const recorded = new Set<ToolErrorStage>();
  return (stage: ToolErrorStage) => {
    if (!recorded.has(stage)) {
      recorded.add(stage);
      recordCodexError(stage);
    }
  };
}

/**
 * Record tool reasoning traces metric
 *
 * @param _tool - Tool name (unused - for future metrics)
 * @param _traceCount - Number of reasoning traces captured (unused - for future metrics)
 */
export function recordToolReasoning(
  _tool: MetricTool,
  _traceCount: number
): void {
  // Future: Add reasoning metrics when counter is added to metrics.ts
  // For now, this is a placeholder for consistent API
}

export const executorServerRegistryTotal = new client.Counter({
  name: "executor_server_registry_total",
  help: "Count of long-lived executor server registry outcomes (start/reuse/restart).",
  labelNames: ["executor", "profile", "outcome"] as const,
  registers: [metricsRegistry],
});

export const executorServerFallbackTotal = new client.Counter({
  name: "executor_server_fallback_total",
  help: "Count of executor server profile fallbacks to default execution.",
  labelNames: ["executor"] as const,
  registers: [metricsRegistry],
});
