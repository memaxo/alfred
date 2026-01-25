/**
 * AgentFS Learning Bridge
 *
 * Extracts tool call patterns and mistakes from AgentFS databases
 * to feed into ALFRED's learning system for self-improvement.
 *
 * Integration points:
 * - packages/learning/src/mistake_ledger.ts - Mistake recording
 * - packages/learning/src/self_supervision.ts - Pattern detection
 * - packages/knowledge/ - Knowledge graph updates
 */

import { existsSync } from "node:fs";

import type { AgentFSInterface } from "./types.js";

import { agentfsLearningExtractionsTotal } from "./metrics.js";
import { AlfredAgentFS } from "./wrapper.js";

/**
 * Analyzed tool call pattern from AgentFS data.
 */
export interface ToolCallPattern {
  /** Tool name */
  toolName: string;
  /** Total number of calls */
  totalCalls: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average execution duration in milliseconds */
  avgDurationMs: number;
  /** Common parameter keys and their frequency */
  commonParameters: Record<string, number>;
  /** List of common error messages */
  commonErrors: string[];
  /** Time range of calls analyzed */
  timeRange: {
    earliest: number;
    latest: number;
  };
}

/**
 * Mistake entry compatible with ALFRED's learning system.
 */
export interface MistakeEntry {
  id: string;
  category: string;
  description: string;
  context: Record<string, unknown>;
  severity: "low" | "medium" | "high";
  timestamp: string;
}

/**
 * Knowledge insight generated from tool call patterns.
 */
export interface LearningInsight {
  id: string;
  derived: string[];
  conclusion: string;
  confidence: {
    value: number;
    source: "statistical" | "heuristic" | "user";
    basis: string;
  };
  rationale: string;
}

/**
 * Extract tool call patterns from an AgentFS database.
 *
 * Analyzes all tool calls to identify:
 * - Frequently used tools
 * - Success/failure rates
 * - Common parameters
 * - Performance characteristics
 *
 * @param agent AgentFS interface (already open)
 * @returns Array of analyzed patterns
 */
export async function extractToolCallPatterns(
  agent: AgentFSInterface
): Promise<ToolCallPattern[]> {
  const stats = await agent.tools.getStats();
  const patterns: ToolCallPattern[] = [];

  for (const stat of stats) {
    const calls = await agent.tools.getByName(stat.name);

    // Analyze parameter frequency
    const paramCounts: Record<string, number> = {};
    const errors: string[] = [];
    let earliest = Number.POSITIVE_INFINITY;
    let latest = Number.NEGATIVE_INFINITY;

    for (const call of calls) {
      // Track time range
      if (call.started_at < earliest) {
        earliest = call.started_at;
      }
      if (call.completed_at > latest) {
        latest = call.completed_at;
      }

      // Count parameter keys
      if (call.parameters && typeof call.parameters === "object") {
        for (const key of Object.keys(call.parameters as object)) {
          paramCounts[key] = (paramCounts[key] ?? 0) + 1;
        }
      }

      // Collect errors
      if (call.error) {
        errors.push(call.error);
      }
    }

    patterns.push({
      toolName: stat.name,
      totalCalls: stat.total_calls,
      successRate:
        stat.total_calls > 0 ? stat.successful / stat.total_calls : 0,
      avgDurationMs: stat.avg_duration_ms,
      commonParameters: paramCounts,
      commonErrors: [...new Set(errors)].slice(0, 10), // Top 10 unique errors
      timeRange: {
        earliest: earliest === Number.POSITIVE_INFINITY ? 0 : earliest,
        latest: latest === Number.NEGATIVE_INFINITY ? 0 : latest,
      },
    });
  }

  agentfsLearningExtractionsTotal.inc({ type: "patterns" });
  return patterns;
}

/**
 * Extract failed tool calls as mistake entries.
 *
 * Converts AgentFS error records into the format expected
 * by ALFRED's mistake_ledger.ts for learning.
 *
 * @param agent AgentFS interface (already open)
 * @param since Unix timestamp to filter from (default: 0 = all)
 * @returns Array of mistake entries
 */
export async function extractMistakes(
  agent: AgentFSInterface,
  since?: number
): Promise<MistakeEntry[]> {
  const calls = await agent.tools.getRecent(since ?? 0);
  const mistakes: MistakeEntry[] = [];

  for (const call of calls) {
    if (call.error) {
      // Determine severity based on duration and error type
      let severity: "low" | "medium" | "high" = "medium";
      if (call.duration_ms > 60_000) {
        severity = "high"; // Long-running failures are high severity
      } else if (call.duration_ms < 1000) {
        severity = "low"; // Quick failures are lower severity
      }

      mistakes.push({
        id: `agentfs-${call.id}`,
        category: `tool:${call.name}`,
        description: call.error,
        context: {
          tool_name: call.name,
          parameters: call.parameters,
          duration_ms: call.duration_ms,
          started_at: call.started_at,
          completed_at: call.completed_at,
        },
        severity,
        timestamp: new Date(call.started_at * 1000).toISOString(),
      });
    }
  }

  agentfsLearningExtractionsTotal.inc({ type: "mistakes" });
  return mistakes;
}

/**
 * Generate knowledge insights from tool call patterns.
 *
 * Analyzes patterns to identify:
 * - Tools with low success rates
 * - Performance bottlenecks
 * - Usage trends
 *
 * @param patterns Analyzed tool call patterns
 * @returns Array of learning insights
 */
export function generateInsights(
  patterns: ToolCallPattern[]
): LearningInsight[] {
  const insights: LearningInsight[] = [];

  for (const pattern of patterns) {
    // Low success rate insight (only if enough data)
    if (pattern.successRate < 0.7 && pattern.totalCalls >= 5) {
      insights.push({
        id: `insight-reliability-${pattern.toolName}-${Date.now().toString(36)}`,
        derived: [],
        conclusion: `Tool "${pattern.toolName}" has low reliability (${(pattern.successRate * 100).toFixed(1)}% success rate)`,
        confidence: {
          value: Math.min(0.9, 0.5 + pattern.totalCalls * 0.02),
          source: "statistical",
          basis: "tool_call_success_rate",
        },
        rationale: `Based on ${pattern.totalCalls} calls. ${pattern.commonErrors.length} unique error types observed: ${pattern.commonErrors.slice(0, 3).join(", ")}${pattern.commonErrors.length > 3 ? "..." : ""}`,
      });
    }

    // Slow execution insight
    if (pattern.avgDurationMs > 10_000 && pattern.totalCalls >= 3) {
      insights.push({
        id: `insight-performance-${pattern.toolName}-${Date.now().toString(36)}`,
        derived: [],
        conclusion: `Tool "${pattern.toolName}" is slow (avg ${(pattern.avgDurationMs / 1000).toFixed(1)}s)`,
        confidence: {
          value: Math.min(0.95, 0.6 + pattern.totalCalls * 0.03),
          source: "statistical",
          basis: "tool_call_performance",
        },
        rationale: `Average execution time of ${(pattern.avgDurationMs / 1000).toFixed(1)}s exceeds 10s threshold based on ${pattern.totalCalls} calls.`,
      });
    }

    // High usage insight
    if (pattern.totalCalls >= 50) {
      insights.push({
        id: `insight-usage-${pattern.toolName}-${Date.now().toString(36)}`,
        derived: [],
        conclusion: `Tool "${pattern.toolName}" is heavily used (${pattern.totalCalls} calls)`,
        confidence: {
          value: 0.95,
          source: "statistical",
          basis: "tool_call_frequency",
        },
        rationale: `This tool is a critical path component. Success rate: ${(pattern.successRate * 100).toFixed(1)}%. Consider optimization if success rate drops.`,
      });
    }

    // Error pattern insight
    if (pattern.commonErrors.length >= 3 && pattern.successRate < 0.9) {
      const errorSummary = pattern.commonErrors
        .slice(0, 3)
        .map((e) => e.slice(0, 50))
        .join("; ");

      insights.push({
        id: `insight-errors-${pattern.toolName}-${Date.now().toString(36)}`,
        derived: [],
        conclusion: `Tool "${pattern.toolName}" has recurring error patterns`,
        confidence: {
          value: 0.8,
          source: "heuristic",
          basis: "error_pattern_analysis",
        },
        rationale: `${pattern.commonErrors.length} unique error types detected. Common patterns: ${errorSummary}`,
      });
    }
  }

  agentfsLearningExtractionsTotal.inc({ type: "insights" });
  return insights;
}

/**
 * Process a completed AgentFS workspace for learning.
 *
 * Call this after an agent run completes to extract learnings
 * and feed them into ALFRED's learning system.
 *
 * @param dbPath Path to the AgentFS database file
 * @returns Extracted patterns, mistakes, and insights
 */
export async function processForLearning(dbPath: string): Promise<{
  patterns: ToolCallPattern[];
  mistakes: MistakeEntry[];
  insights: LearningInsight[];
}> {
  // Validate file exists before attempting to open
  if (!existsSync(dbPath)) {
    throw new Error(`agentfs_database_not_found: ${dbPath}`);
  }

  let agent: AgentFSInterface;
  agent = await AlfredAgentFS.open({ id: "learning", path: dbPath });

  try {
    const patterns = await extractToolCallPatterns(agent);
    const mistakes = await extractMistakes(agent);
    const insights = generateInsights(patterns);

    return { patterns, mistakes, insights };
  } finally {
    await agent.close();
  }
}

/**
 * Get a summary of tool usage from an AgentFS database.
 *
 * Useful for quick inspection without full pattern analysis.
 *
 * @param agent AgentFS interface (already open)
 * @returns Summary statistics
 */
export async function getToolUsageSummary(agent: AgentFSInterface): Promise<{
  totalCalls: number;
  totalTools: number;
  overallSuccessRate: number;
  avgDurationMs: number;
  topTools: { name: string; calls: number; successRate: number }[];
}> {
  const stats = await agent.tools.getStats();

  let totalCalls = 0;
  let totalSuccessful = 0;
  let totalDuration = 0;

  for (const stat of stats) {
    totalCalls += stat.total_calls;
    totalSuccessful += stat.successful;
    totalDuration += stat.avg_duration_ms * stat.total_calls;
  }

  const topTools = stats
    .sort((a, b) => b.total_calls - a.total_calls)
    .slice(0, 5)
    .map((s) => ({
      name: s.name,
      calls: s.total_calls,
      successRate: s.total_calls > 0 ? s.successful / s.total_calls : 0,
    }));

  return {
    totalCalls,
    totalTools: stats.length,
    overallSuccessRate: totalCalls > 0 ? totalSuccessful / totalCalls : 0,
    avgDurationMs: totalCalls > 0 ? totalDuration / totalCalls : 0,
    topTools,
  };
}
