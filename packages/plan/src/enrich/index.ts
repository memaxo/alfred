/**
 * Task Enrichment Query Layer
 *
 * Queries enrichment data from all available sources and applies
 * it to tasks before decomposition/spawn.
 */

import { logger } from "@alfred/logger";
import {
  type EnrichmentMetadata,
  type FailureContext,
  type RelevantHeuristic,
  type SimilarExecution,
  type StructuredHandoff,
  type TaskEnrichment,
  type UpstreamFailure,
} from "@alfred/type";
import { type SubTask } from "@alfred/type/plan";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EnrichmentOptions {
  runId: string;
  resource: string;
  maxSimilarExecutions?: number;
  maxHeuristics?: number;
  includeUpstreamFailures?: boolean;
}

export interface EnrichmentSource {
  queryExecutions: (
    resource: string,
    requirement: string,
    limit: number
  ) => Promise<SimilarExecution[]>;
  queryHeuristics: (
    requirement: string,
    limit: number
  ) => Promise<RelevantHeuristic[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Source (uses @alfred/db when available)
// ─────────────────────────────────────────────────────────────────────────────

async function getDefaultSource(): Promise<EnrichmentSource | null> {
  try {
    const { findSimilarCodexExecutions, findRelevantHeuristics } =
      await import("@alfred/db/repo/codex-learning");

    return {
      queryExecutions: async (resource, requirement, limit) => {
        const results = await findSimilarCodexExecutions(
          resource,
          requirement,
          limit
        );
        return results.map((r) => ({
          runId: r.sessionId ?? "",
          similarity: r.similarity,
          status: r.result ? "completed" : "unknown",
          summary: r.result?.slice(0, 200) ?? "",
          taskId: r.nodeId,
        }));
      },
      queryHeuristics: async (requirement, limit) => {
        const results = await findRelevantHeuristics(requirement, limit);
        return results.map((h) => ({
          domain: h.domain ?? "workflow",
          rule: h.rule ?? "",
          severity: (h.severity as "low" | "medium" | "high") ?? "medium",
          sourceRunId: undefined,
          sourceTaskId: undefined,
        }));
      },
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Enrichment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query enrichment data for a task from all available sources.
 */
export async function queryTaskEnrichment(
  task: SubTask,
  opts: EnrichmentOptions,
  source?: EnrichmentSource
): Promise<TaskEnrichment> {
  const enrichmentSource = source ?? (await getDefaultSource());

  let similarExecutions: SimilarExecution[] = [];
  let relevantHeuristics: RelevantHeuristic[] = [];

  if (enrichmentSource) {
    try {
      const [executions, heuristics] = await Promise.all([
        enrichmentSource.queryExecutions(
          opts.resource,
          task.requirement,
          opts.maxSimilarExecutions ?? 3
        ),
        enrichmentSource.queryHeuristics(
          task.requirement,
          opts.maxHeuristics ?? 5
        ),
      ]);

      similarExecutions = executions;
      relevantHeuristics = heuristics;
    } catch (error) {
      logger.warn("enrichment_query_failed", {
        error: error instanceof Error ? error.message : String(error),
        taskId: task.id,
      });
    }
  }

  return {
    relevantHeuristics,
    similarExecutions,
    taskId: task.id,
    ts: Date.now(),
    upstreamFailures: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply Enrichment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format enrichment data as markdown for injection into task requirement.
 */
function formatEnrichmentBlock(enrichment: TaskEnrichment): string {
  const sections: string[] = [];

  if (enrichment.similarExecutions.length > 0) {
    sections.push("## Prior Similar Tasks");
    for (const exec of enrichment.similarExecutions) {
      const statusIcon = exec.status === "completed" ? "✓" : "✗";
      sections.push(
        `- [${statusIcon}] ${exec.summary || "No summary"} (similarity: ${(exec.similarity * 100).toFixed(0)}%)`
      );
    }
  }

  if (enrichment.relevantHeuristics.length > 0) {
    sections.push("## Learned Heuristics");
    for (const h of enrichment.relevantHeuristics) {
      const severityIcon =
        h.severity === "high" ? "⚠" : h.severity === "medium" ? "!" : "i";
      sections.push(`- [${severityIcon}/${h.domain}] ${h.rule}`);
    }
  }

  if (enrichment.upstreamFailures.length > 0) {
    sections.push("## Upstream Task Failures");
    for (const f of enrichment.upstreamFailures) {
      sections.push(`- Task ${f.taskId} failed: ${f.summary}`);
      if (f.toolsToAvoid.length > 0) {
        sections.push(`  - Avoid tools: ${f.toolsToAvoid.join(", ")}`);
      }
    }
  }

  if (enrichment.handoffContext) {
    sections.push("## Handoff from Previous Wave");
    sections.push(enrichment.handoffContext.summary);

    if (enrichment.handoffContext.decisions.length > 0) {
      sections.push("### Decisions Made:");
      for (const d of enrichment.handoffContext.decisions) {
        sections.push(`- ${d.decision}: ${d.rationale}`);
      }
    }

    if (enrichment.handoffContext.toolsAvoided.length > 0) {
      sections.push("### Tools to Avoid:");
      for (const t of enrichment.handoffContext.toolsAvoided) {
        sections.push(`- ${t.tool}: ${t.reason}`);
      }
    }

    if (enrichment.handoffContext.blockers.length > 0) {
      sections.push("### Known Blockers:");
      for (const b of enrichment.handoffContext.blockers) {
        sections.push(`- ${b}`);
      }
    }
  }

  return sections.join("\n");
}

/**
 * Build enrichment metadata for attachment to task.
 */
function buildEnrichmentMetadata(
  enrichment: TaskEnrichment
): EnrichmentMetadata {
  return {
    enrichedAt: Date.now(),
    enrichmentSources: {
      hasHandoff: !!enrichment.handoffContext,
      heuristics: enrichment.relevantHeuristics.length,
      similarExecutions: enrichment.similarExecutions.length,
      upstreamFailures: enrichment.upstreamFailures.length,
    },
  };
}

/**
 * Inject enrichment into task requirement text.
 */
export function applyEnrichmentToTask(
  task: SubTask,
  enrichment: TaskEnrichment
): SubTask {
  const enrichmentBlock = formatEnrichmentBlock(enrichment);

  if (!enrichmentBlock) {
    return task;
  }

  const separator = "\n\n---\n# Context from Prior Runs\n";
  const enrichedRequirement = `${task.requirement}${separator}${enrichmentBlock}\n---\n`;

  return {
    ...task,
    requirement: enrichedRequirement,
    metadata: {
      ...task.metadata,
      ...buildEnrichmentMetadata(enrichment),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Enrichment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enrich multiple tasks in parallel.
 */
export async function enrichTasks(
  tasks: SubTask[],
  opts: EnrichmentOptions,
  source?: EnrichmentSource
): Promise<SubTask[]> {
  const enrichmentSource = source ?? (await getDefaultSource());

  if (!enrichmentSource) {
    logger.info("enrichment_source_unavailable", {
      reason: "No enrichment source available, returning tasks unchanged",
    });
    return tasks;
  }

  const enrichedTasks = await Promise.all(
    tasks.map(async (task) => {
      try {
        const enrichment = await queryTaskEnrichment(
          task,
          opts,
          enrichmentSource
        );
        return applyEnrichmentToTask(task, enrichment);
      } catch (error) {
        logger.warn("task_enrichment_failed", {
          error: error instanceof Error ? error.message : String(error),
          taskId: task.id,
        });
        return task;
      }
    })
  );

  return enrichedTasks;
}

// ─────────────────────────────────────────────────────────────────────────────
// With Upstream Failures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add upstream failure context to enrichment.
 */
export function addUpstreamFailures(
  enrichment: TaskEnrichment,
  failures: Map<string, FailureContext>,
  taskDeps: string[]
): TaskEnrichment {
  const upstreamFailures: UpstreamFailure[] = [];

  for (const depId of taskDeps) {
    const failure = failures.get(depId);
    if (failure) {
      upstreamFailures.push({
        summary: `Failed with status: ${failure.status}. ${
          failure.stuckReason ?? failure.escalations[0]?.details ?? ""
        }`.trim(),
        taskId: depId,
        toolsToAvoid: failure.toolErrors
          .filter((e) => e.count >= 2)
          .map((e) => e.tool),
      });
    }
  }

  return {
    ...enrichment,
    upstreamFailures: [...enrichment.upstreamFailures, ...upstreamFailures],
  };
}

/**
 * Add structured handoff context to enrichment.
 */
export function addHandoffContext(
  enrichment: TaskEnrichment,
  handoff: StructuredHandoff
): TaskEnrichment {
  return {
    ...enrichment,
    handoffContext: handoff,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution Delta Generation
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

const resolutionDeltaSchema = z.object({
  category: z
    .enum([
      "config",
      "deps",
      "syntax",
      "logic",
      "environment",
      "permissions",
      "other",
    ])
    .describe("The category of fix that resolved the issue"),
  delta: z
    .string()
    .describe(
      "A concise 1-3 sentence description of what changed between the failure and success"
    ),
  keyInsight: z
    .string()
    .describe(
      "The main insight that would help someone facing a similar failure"
    ),
});

export type ResolutionDelta = z.infer<typeof resolutionDeltaSchema>;

/**
 * Generate a human-readable delta describing what changed between
 * a failed execution and a successful retry.
 *
 * Uses LLM to analyze the difference and produce a concise summary
 * that can be used to enrich future similar tasks.
 *
 * Falls back to heuristic-based delta generation when:
 * - ALFRED_CLASSIFY_OFFLINE=1 is set
 * - LLM call fails
 */
export async function generateResolutionDelta(
  failureContext: FailureContext,
  successContext: {
    toolsUsed: string[];
    filesChanged: string[];
    durationMs: number;
  }
): Promise<ResolutionDelta> {
  // Check offline mode first
  if (process.env.ALFRED_CLASSIFY_OFFLINE === "1") {
    return buildHeuristicDelta(failureContext, successContext);
  }

  // Build prompt from failure and success contexts
  const failedTools = failureContext.toolErrors.map((e) => e.tool).join(", ");
  const failedErrors = failureContext.toolErrors
    .map((e) => `${e.tool}: ${e.error}`)
    .slice(0, 3)
    .join("\n");

  const prompt = `Analyze how a task failure was resolved and generate a concise summary.

## Failure Context
- Status: ${failureContext.status}
- Failed tools: ${failedTools || "none"}
- Errors:
${failedErrors || "No specific errors"}
${failureContext.stuckReason ? `- Stuck reason: ${failureContext.stuckReason}` : ""}

## Success Context  
- Tools used: ${successContext.toolsUsed.join(", ") || "none"}
- Files changed: ${successContext.filesChanged.join(", ") || "none"}
- Duration: ${(successContext.durationMs / 1000).toFixed(1)}s

Generate a delta summary explaining what changed to fix the issue.`;

  try {
    const { generateObject } = await import("ai");
    const { cerebras } = await import("@ai-sdk/cerebras");

    const result = await generateObject({
      model: cerebras("llama-4-scout-17b-16e-instruct") as Parameters<
        typeof generateObject
      >[0]["model"],
      prompt,
      schema: resolutionDeltaSchema,
    });

    return result.object;
  } catch (error) {
    logger.warn("resolution_delta_generation_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return buildHeuristicDelta(failureContext, successContext);
  }
}

/**
 * Build a heuristic delta when LLM is unavailable.
 */
function buildHeuristicDelta(
  failureContext: FailureContext,
  successContext: {
    toolsUsed: string[];
    filesChanged: string[];
  }
): ResolutionDelta {
  // Determine what tools succeeded that previously failed
  const failedTools = new Set(failureContext.toolErrors.map((e) => e.tool));
  const succeededTools = successContext.toolsUsed.filter((t) =>
    failedTools.has(t)
  );

  let delta: string;
  let category: ResolutionDelta["category"] = "other";
  let keyInsight: string;

  if (succeededTools.length > 0) {
    delta = `Retry succeeded after ${succeededTools.join(", ")} previously failed. Changed files: ${successContext.filesChanged.slice(0, 3).join(", ")}`;
    category = "logic";
    keyInsight = `Tool ${succeededTools[0]} may have transient issues - retry after modifications`;
  } else if (successContext.filesChanged.length > 0) {
    const hasConfig = successContext.filesChanged.some(
      (f) => f.includes("config") || f.includes(".json") || f.includes(".yaml")
    );
    const hasDeps = successContext.filesChanged.some(
      (f) => f.includes("package") || f.includes("requirements")
    );

    if (hasConfig) {
      category = "config";
      delta = `Fixed configuration in: ${successContext.filesChanged.filter((f) => f.includes("config")).join(", ")}`;
      keyInsight = "Configuration issues may require examining config files";
    } else if (hasDeps) {
      category = "deps";
      delta = `Fixed dependencies in: ${successContext.filesChanged.filter((f) => f.includes("package")).join(", ")}`;
      keyInsight = "Dependency conflicts should be checked in package files";
    } else {
      delta = `Fixed by modifying: ${successContext.filesChanged.slice(0, 3).join(", ")}`;
      keyInsight = "Similar failures may require changes to the same files";
    }
  } else {
    delta = `Retry succeeded without apparent file changes - possibly transient issue`;
    keyInsight = "Some failures may be transient and resolve on retry";
    category = "environment";
  }

  return { category, delta, keyInsight };
}
