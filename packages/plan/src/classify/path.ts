/**
 * Path classification for file bucketing.
 *
 * Uses LLM-based batch classification by default with heuristic fallback.
 * @see .ruler/55-llm-first-classification.md
 */

import type { LanguageModel } from "ai";

import { z } from "zod";

import { classifyBatch, OFFLINE_MODE } from "./index.js";

/**
 * Path bucket types
 */
export const PATH_BUCKETS = ["backend", "frontend", "test", "misc"] as const;

export type PathBucket = (typeof PATH_BUCKETS)[number];

/**
 * Schema for batch path classification
 */
const pathClassificationSchema = z.object({
  assignments: z.array(
    z.object({
      index: z.number(),
      bucket: z.enum(PATH_BUCKETS),
    })
  ),
});

/**
 * Options for path classification
 */
export type ClassifyPathOptions = {
  /** Model to use for batch classification */
  model?: LanguageModel;
  /** Model key for logging */
  modelKey?: string;
};

/**
 * Heuristic fallback for path classification.
 * Used when ALFRED_CLASSIFY_OFFLINE=1 or when LLM call fails.
 */
export function classifyPathHeuristic(path: string): PathBucket {
  const lower = path.toLowerCase();

  // Backend patterns
  if (
    lower.includes("/api/") ||
    lower.includes("/server/") ||
    lower.includes("/backend/") ||
    lower.includes("/routers/") ||
    lower.includes("/services/") ||
    lower.endsWith(".server.ts") ||
    lower.endsWith(".server.tsx")
  ) {
    return "backend";
  }

  // Test patterns (check before frontend since .test.tsx could match)
  if (
    lower.includes("__tests__") ||
    lower.includes("/test/") ||
    lower.endsWith(".test.ts") ||
    lower.endsWith(".spec.ts") ||
    lower.endsWith(".test.tsx") ||
    lower.endsWith(".spec.tsx")
  ) {
    return "test";
  }

  // Frontend patterns
  if (
    lower.includes("/app/") ||
    lower.includes("/pages/") ||
    lower.includes("/components/") ||
    lower.includes("/hooks/") ||
    lower.endsWith(".client.tsx") ||
    lower.endsWith(".tsx")
  ) {
    return "frontend";
  }

  return "misc";
}

/**
 * Classify a single path (synchronous heuristic).
 *
 * For batch classification with LLM support, use `classifyPaths()`.
 */
export function classifyPath(path: string): PathBucket {
  return classifyPathHeuristic(path);
}

/**
 * Build the classification prompt for batch path assignment.
 */
function buildPathPrompt(paths: string[]): string {
  const pathList = paths.map((p, i) => `${i}: ${p}`).join("\n");

  return `Classify each file path into exactly one bucket.

Buckets:
- backend: API routes, server logic, services, routers
- frontend: UI components, pages, hooks, client code
- test: Test files, spec files, test utilities
- misc: Config, docs, scripts, other files

Paths:
${pathList}

Return assignments as array of {index, bucket} for each path.`;
}

/**
 * Batch classify multiple paths.
 *
 * Uses LLM-based classification by default for semantic understanding.
 * Falls back to heuristics when:
 * - ALFRED_CLASSIFY_OFFLINE=1 is set
 * - No model is provided
 * - LLM call fails
 *
 * @param paths - Array of file paths to classify
 * @param options - Classification options including model
 * @returns Map of path to bucket assignment
 */
export async function classifyPaths(
  paths: string[],
  options: ClassifyPathOptions = {}
): Promise<Map<string, PathBucket>> {
  const { model, modelKey } = options;
  const result = new Map<string, PathBucket>();

  if (paths.length === 0) {
    return result;
  }

  // Use heuristic in offline mode or if no model provided
  if (OFFLINE_MODE || !model) {
    for (const path of paths) {
      result.set(path, classifyPathHeuristic(path));
    }
    return result;
  }

  try {
    const response = await classifyBatch(
      pathClassificationSchema,
      buildPathPrompt(paths),
      "",
      {
        model,
        modelKey,
        metricType: "path",
        fallback: () => ({
          assignments: paths.map((p, i) => ({
            index: i,
            bucket: classifyPathHeuristic(p),
          })),
        }),
      }
    );

    // Build result map from assignments
    for (const assignment of response.result.assignments) {
      const path = paths[assignment.index];
      if (path !== undefined && PATH_BUCKETS.includes(assignment.bucket)) {
        result.set(path, assignment.bucket);
      }
    }

    // Handle any paths not assigned (defensive)
    const assignedIndices = new Set(
      response.result.assignments.map((a) => a.index)
    );
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (path !== undefined && !assignedIndices.has(i)) {
        result.set(path, classifyPathHeuristic(path));
      }
    }

    return result;
  } catch {
    // Fall back to heuristics on any error
    for (const path of paths) {
      result.set(path, classifyPathHeuristic(path));
    }
    return result;
  }
}

/**
 * Classify paths with metadata.
 * Includes classification source and latency.
 */
export async function classifyPathsWithMetadata(
  paths: string[],
  options: ClassifyPathOptions & { model: LanguageModel }
): Promise<{
  assignments: Map<string, PathBucket>;
  source: "llm" | "fallback";
  latencyMs: number;
}> {
  const start = performance.now();

  if (paths.length === 0) {
    return {
      assignments: new Map(),
      source: "fallback",
      latencyMs: 0,
    };
  }

  const { model, modelKey } = options;

  if (OFFLINE_MODE) {
    const assignments = new Map<string, PathBucket>();
    for (const path of paths) {
      assignments.set(path, classifyPathHeuristic(path));
    }
    return {
      assignments,
      source: "fallback",
      latencyMs: performance.now() - start,
    };
  }

  try {
    const response = await classifyBatch(
      pathClassificationSchema,
      buildPathPrompt(paths),
      "",
      { model, modelKey, metricType: "path" }
    );

    const assignments = new Map<string, PathBucket>();
    for (const assignment of response.result.assignments) {
      const path = paths[assignment.index];
      if (path !== undefined && PATH_BUCKETS.includes(assignment.bucket)) {
        assignments.set(path, assignment.bucket);
      }
    }

    // Handle unassigned
    const assignedIndices = new Set(
      response.result.assignments.map((a) => a.index)
    );
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (path !== undefined && !assignedIndices.has(i)) {
        assignments.set(path, classifyPathHeuristic(path));
      }
    }

    return {
      assignments,
      source: response.source,
      latencyMs: performance.now() - start,
    };
  } catch {
    const assignments = new Map<string, PathBucket>();
    for (const path of paths) {
      assignments.set(path, classifyPathHeuristic(path));
    }
    return {
      assignments,
      source: "fallback",
      latencyMs: performance.now() - start,
    };
  }
}
