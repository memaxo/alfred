import type { FailureContext, StructuredHandoff } from "@alfred/type";
import type {
  ContextBundle,
  DecomposeContext,
  SubTask,
  SubTaskId,
} from "@alfred/type/plan";

import { logger } from "@alfred/logger";

import { classifyPath, type PathBucket } from "../classify/index.js";
import {
  addHandoffContext,
  addUpstreamFailures,
  applyEnrichmentToTask,
  enrichTasks,
  queryTaskEnrichment,
  type EnrichmentOptions,
  type EnrichmentSource,
} from "../enrich/index.js";
import { propagateUpstreamFailures } from "../enrich/propagate.js";

// Type alias for backward compatibility
type Bucket = PathBucket;

const MAX_SUBTASKS =
  Number.parseInt(process.env.MAX_SUBTASKS ?? "10", 10) || 10;

function getDecompositionTruncatedMetric() {
  try {
    // Lazy import to avoid circular dependencies
    const metrics = require("@alfred/metrics/shared");
    return metrics.decompositionTruncatedTotal;
  } catch {
    return null;
  }
}

/**
 * Stub for semantic decomposition to break circular dependency with @alfred/agent.
 * In Phase 4, this logic should be moved to @alfred/plan or a shared reasoning package.
 */
export function decomposeSemantically(
  _requirement: string,
  _bundle: ContextBundle
): SubTask[] {
  return [];
}

function normalisePrefix(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) {
    return ".";
  }
  return path.slice(0, idx);
}

/**
 * FNV-1a hash for fast task ID generation.
 * Chosen for speed and good distribution on short strings.
 * Faster than SHA-256 for this use case.
 */
function stableId(seed: string): SubTaskId {
  // FNV-1a hash (32-bit)
  let h = 2_166_136_261; // FNV offset basis
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.codePointAt(i) ?? 0;
    h = (h * 16_777_619) >>> 0; // FNV prime, ensure unsigned 32-bit
  }
  // Convert to hex and take first 8 characters (matching previous format)
  const hex = h.toString(16).padStart(8, "0");
  return `T${hex}`;
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function truncateSubtasksIfNeeded(
  tasks: SubTask[],
  reason: "semantic" | "bucket"
): SubTask[] {
  if (tasks.length <= MAX_SUBTASKS) {
    return tasks;
  }

  const originalCount = tasks.length;
  const truncated = tasks.slice(0, MAX_SUBTASKS);

  logger.warn("decomposition_truncated", {
    originalCount,
    reason,
    truncatedCount: MAX_SUBTASKS,
  });

  const metric = getDecompositionTruncatedMetric();
  metric?.inc({ reason });

  return truncated;
}

/**
 * Validate and fix task dependencies.
 * Removes invalid deps (unknown IDs, self-references) and logs warnings.
 */
function validateAndFixDependencies(tasks: SubTask[]): SubTask[] {
  const ids = new Set(tasks.map((t) => t.id));
  const warnings: string[] = [];

  const fixed = tasks.map((task) => {
    const validDeps: SubTaskId[] = [];

    for (const dep of task.deps) {
      if (dep === task.id) {
        warnings.push(`Task ${task.id} has self-dependency`);
        continue;
      }
      if (!ids.has(dep)) {
        warnings.push(`Task ${task.id} references unknown dep: ${dep}`);
        continue;
      }
      validDeps.push(dep);
    }

    if (validDeps.length !== task.deps.length) {
      return { ...task, deps: validDeps };
    }
    return task;
  });

  if (warnings.length > 0) {
    logger.warn("decompose_invalid_deps", { errors: warnings });
  }

  return fixed;
}

export function decomposeTask(
  requirement: string,
  context: DecomposeContext
): SubTask[] {
  const trimmedRequirement = requirement.trim();
  const baseRequirement =
    trimmedRequirement.length > 0
      ? trimmedRequirement
      : "Implement the requested change.";

  const files = context.bundle?.files ?? [];

  if (files.length === 0) {
    const id = stableId(`${baseRequirement}|root`);
    return [
      {
        acceptance: ["Changes implemented and tests passing."],
        deps: [],
        filesHint: [],
        id,
        priority: 1,
        requirement: baseRequirement,
        title: baseRequirement.slice(0, 80),
      },
    ];
  }

  // Phase 1: Semantic Decomposition
  // If we have file contents, try to decompose semantically.
  if (context.bundle && files.some((f) => f.content)) {
    try {
      const semanticTasks = decomposeSemantically(
        baseRequirement,
        context.bundle
      );
      if (semanticTasks.length > 0) {
        return validateAndFixDependencies(
          truncateSubtasksIfNeeded(semanticTasks, "semantic")
        );
      }
    } catch {
      // Fallback to legacy bucket heuristic if semantic fails
    }
  }

  const buckets: Record<Bucket, Set<string>> = {
    backend: new Set<string>(),
    frontend: new Set<string>(),
    misc: new Set<string>(),
    test: new Set<string>(),
  };

  for (const file of files) {
    const { path } = file;
    if (!path || typeof path !== "string") {
      continue;
    }
    const bucket = classifyPath(path);
    buckets[bucket].add(normalisePrefix(path));
  }

  interface PartialTask {
    kind: Bucket;
    title: string;
    acceptance: string[];
  }

  const partials: PartialTask[] = [];

  if (buckets.backend.size > 0) {
    partials.push({
      acceptance: [
        "Server builds and runs.",
        "Endpoints updated and tests passing.",
      ],
      kind: "backend",
      title: "Backend changes",
    });
  }

  if (buckets.frontend.size > 0) {
    partials.push({
      acceptance: [
        "UI builds and renders.",
        "Primary flows work without errors.",
      ],
      kind: "frontend",
      title: "Frontend changes",
    });
  }

  if (buckets.test.size > 0) {
    partials.push({
      acceptance: ["Relevant tests written and passing."],
      kind: "test",
      title: "Tests and validation",
    });
  }

  if (partials.length === 0) {
    // Fallback: single generic task if heuristics did not classify anything.
    const id = stableId(`${baseRequirement}|generic`);
    const prefixHints = uniq(
      files
        .map((f) => (f.path ? normalisePrefix(f.path) : null))
        .filter((p): p is string => Boolean(p))
    );
    return [
      {
        acceptance: ["Changes implemented and tests passing."],
        deps: [],
        filesHint: prefixHints,
        id,
        priority: 1,
        requirement: baseRequirement,
        title: baseRequirement.slice(0, 80),
      },
    ];
  }

  const result: SubTask[] = [];

  const taskFor: Record<Bucket, SubTaskId | null> = {
    backend: null,
    frontend: null,
    misc: null,
    test: null,
  };

  const frontendDependsOnBackend =
    buckets.backend.size > 0 && buckets.frontend.size > 0;

  for (const partial of partials) {
    const prefixes = [...buckets[partial.kind]].toSorted();
    const hint = prefixes.length > 0 ? prefixes : ["."];
    const seed = `${baseRequirement}|${partial.kind}|${hint.join(",")}`;
    const id = stableId(seed);

    const deps: SubTaskId[] = [];
    if (partial.kind === "frontend" && frontendDependsOnBackend) {
      // Will fill actual backend id after creation.
      // Placeholder; updated once backend id known.
    }

    const priority = (() => {
      switch (partial.kind) {
        case "backend": {
          return 1;
        }
        case "frontend": {
          return 0.9;
        }
        case "test": {
          return 0.8;
        }
        default: {
          return 0.5;
        }
      }
    })();

    const subTask: SubTask = {
      acceptance: partial.acceptance,
      deps,
      filesHint: hint,
      id,
      priority,
      requirement: baseRequirement,
      title: partial.title,
    };

    result.push(subTask);
    taskFor[partial.kind] = id;
  }

  // Wire dependencies after all ids are known.
  const backendId = taskFor.backend;
  const frontendId = taskFor.frontend;
  if (backendId && frontendId && frontendDependsOnBackend) {
    const frontendTask = result.find((t) => t.id === frontendId);
    if (frontendTask) {
      frontendTask.deps = uniq([backendId, ...frontendTask.deps]);
    }
  }

  const backendAndFrontendIds = [backendId, frontendId].filter(
    (v): v is SubTaskId => Boolean(v)
  );
  const testId = taskFor.test;
  if (testId && backendAndFrontendIds.length > 0) {
    const testTask = result.find((t) => t.id === testId);
    if (testTask) {
      testTask.deps = uniq([...backendAndFrontendIds, ...testTask.deps]);
    }
  }

  result.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  return validateAndFixDependencies(truncateSubtasksIfNeeded(result, "bucket"));
}

export const __internals = {
  classifyPath,
  normalisePrefix,
  stableId,
  uniq,
};

// ─────────────────────────────────────────────────────────────────────────────
// Enriched Decomposition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for task decomposition with enrichment.
 */
export interface DecomposeWithEnrichmentOptions {
  /** Enable enrichment from prior executions and heuristics */
  enableEnrichment?: boolean;
  /** Run ID for this decomposition */
  runId?: string;
  /** Resource identifier for similarity matching */
  resource?: string;
  /** Custom enrichment source (for testing) */
  enrichmentSource?: EnrichmentSource;
  /** Map of failed task IDs to their failure contexts */
  upstreamFailures?: Map<string, FailureContext>;
  /** Structured handoff from previous wave */
  handoff?: StructuredHandoff;
  /** Maximum similar executions to include (default: 3) */
  maxSimilarExecutions?: number;
  /** Maximum heuristics to include (default: 5) */
  maxHeuristics?: number;
}

/**
 * Decompose a task with enrichment from prior runs.
 *
 * This is the enhanced version of decomposeTask that:
 * 1. Performs standard decomposition
 * 2. Queries enrichment data (similar executions, heuristics)
 * 3. Propagates upstream failure context
 * 4. Injects handoff context from previous waves
 * 5. Applies all enrichment to task requirements
 */
export async function decomposeTaskWithEnrichment(
  requirement: string,
  context: DecomposeContext,
  options?: DecomposeWithEnrichmentOptions
): Promise<SubTask[]> {
  // Standard decomposition
  let tasks = decomposeTask(requirement, context);

  // Skip enrichment if disabled or missing required context
  if (!options?.enableEnrichment) {
    return tasks;
  }

  const { runId } = options;
  const { resource } = options;

  // Propagate upstream failures first (modifies metadata)
  if (options.upstreamFailures && options.upstreamFailures.size > 0) {
    tasks = propagateUpstreamFailures(tasks, options.upstreamFailures, {
      includeTransitive: true,
      maxUpstreamFailures: 5,
    });
  }

  // If we have run context, query and apply enrichment
  if (runId && resource) {
    const enrichmentOpts: EnrichmentOptions = {
      maxHeuristics: options.maxHeuristics ?? 5,
      maxSimilarExecutions: options.maxSimilarExecutions ?? 3,
      resource,
      runId,
    };

    tasks = await enrichTasks(tasks, enrichmentOpts, options.enrichmentSource);
  }

  // Apply handoff context to all tasks if provided
  if (options.handoff) {
    tasks = tasks.map((task) => {
      const ts = Date.now();
      // Query existing enrichment or create minimal one
      const existingEnrichment = {
        createdAt: ts,
        relevantHeuristics: [],
        schemaVersion: 1,
        similarExecutions: [],
        taskId: task.id,
        ts,
        upstreamFailures: (task.metadata?.upstreamFailures as any[]) ?? [],
      };

      const withHandoff = addHandoffContext(
        existingEnrichment,
        options.handoff!
      );
      return applyEnrichmentToTask(task, withHandoff);
    });
  }

  return tasks;
}

/**
 * Re-export enrichment utilities for external use.
 */
export {
  addHandoffContext,
  addUpstreamFailures,
  applyEnrichmentToTask,
  enrichTasks,
  propagateUpstreamFailures,
  queryTaskEnrichment,
  type EnrichmentOptions,
  type EnrichmentSource,
};
