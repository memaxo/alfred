import type { ContextBundle } from "@alfred/type/plan";
import { logger } from "@alfred/logger";
import { decomposeSemantically } from "../reasoning/decompose-semantic";

const MAX_SUBTASKS = Number.parseInt(
  process.env.MAX_SUBTASKS ?? "10",
  10
) || 10;

function getDecompositionTruncatedMetric() {
  try {
    // Lazy import to avoid circular dependencies
    const metrics = require("@alfred/api/metrics");
    return metrics.decompositionTruncatedTotal;
  } catch {
    return null;
  }
}

export type SubTaskId = string;

export type SubTask = {
  id: SubTaskId;
  title: string;
  requirement: string;
  deps: SubTaskId[];
  priority: number;
  acceptance: string[];
  filesHint: string[];
};

export type DecomposeContext = {
  requirement: string;
  bundle: ContextBundle | null;
};

type Bucket = "backend" | "frontend" | "test" | "misc";

function classifyPath(path: string): Bucket {
  const lower = path.toLowerCase();
  if (
    lower.includes("/api/") ||
    lower.includes("/server/") ||
    lower.includes("/backend/") ||
    lower.endsWith(".server.ts") ||
    lower.endsWith(".server.tsx")
  ) {
    return "backend";
  }
  if (
    lower.includes("/app/") ||
    lower.includes("/pages/") ||
    lower.includes("/components/") ||
    lower.endsWith(".client.tsx") ||
    lower.endsWith(".tsx")
  ) {
    return "frontend";
  }
  if (
    lower.includes("__tests__") ||
    lower.endsWith(".test.ts") ||
    lower.endsWith(".spec.ts") ||
    lower.endsWith(".test.tsx") ||
    lower.endsWith(".spec.tsx")
  ) {
    return "test";
  }
  return "misc";
}

function normalisePrefix(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) {
    return ".";
  }
  return path.slice(0, idx);
}

function stableId(seed: string): SubTaskId {
  // Deterministic, cheap hash; not cryptographic.
  let h1 = 0x81_1c_9d_c5;
  for (let i = 0; i < seed.length; i += 1) {
    h1 ^= seed.charCodeAt(i) & 0xff;
    h1 = (h1 * 0x01_00_01_93) >>> 0;
  }
  return `T${(h1 >>> 0).toString(16)}`;
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
    truncatedCount: MAX_SUBTASKS,
    reason,
  });

  const metric = getDecompositionTruncatedMetric();
  metric?.inc({ reason });

  return truncated;
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
        id,
        title: baseRequirement.slice(0, 80),
        requirement: baseRequirement,
        deps: [],
        priority: 1,
        acceptance: ["Changes implemented and tests passing."],
        filesHint: [],
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
        return truncateSubtasksIfNeeded(semanticTasks, "semantic");
      }
    } catch (_e) {
      // Fallback to legacy bucket heuristic if semantic fails
      // console.warn("Semantic decomposition failed", e);
    }
  }

  const buckets: Record<Bucket, Set<string>> = {
    backend: new Set<string>(),
    frontend: new Set<string>(),
    test: new Set<string>(),
    misc: new Set<string>(),
  };

  for (const file of files) {
    const path = file.path;
    if (!path || typeof path !== "string") {
      continue;
    }
    const bucket = classifyPath(path);
    buckets[bucket].add(normalisePrefix(path));
  }

  type PartialTask = {
    kind: Bucket;
    title: string;
    acceptance: string[];
  };

  const partials: PartialTask[] = [];

  if (buckets.backend.size > 0) {
    partials.push({
      kind: "backend",
      title: "Backend changes",
      acceptance: [
        "Server builds and runs.",
        "Endpoints updated and tests passing.",
      ],
    });
  }

  if (buckets.frontend.size > 0) {
    partials.push({
      kind: "frontend",
      title: "Frontend changes",
      acceptance: [
        "UI builds and renders.",
        "Primary flows work without errors.",
      ],
    });
  }

  if (buckets.test.size > 0) {
    partials.push({
      kind: "test",
      title: "Tests and validation",
      acceptance: ["Relevant tests written and passing."],
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
        id,
        title: baseRequirement.slice(0, 80),
        requirement: baseRequirement,
        deps: [],
        priority: 1,
        acceptance: ["Changes implemented and tests passing."],
        filesHint: prefixHints,
      },
    ];
  }

  const result: SubTask[] = [];

  const taskFor: Record<Bucket, SubTaskId | null> = {
    backend: null,
    frontend: null,
    test: null,
    misc: null,
  };

  const frontendDependsOnBackend =
    buckets.backend.size > 0 && buckets.frontend.size > 0;

  for (const partial of partials) {
    const prefixes = Array.from(buckets[partial.kind]).sort();
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
        case "backend":
          return 1;
        case "frontend":
          return 0.9;
        case "test":
          return 0.8;
        default:
          return 0.5;
      }
    })();

    const subTask: SubTask = {
      id,
      title: partial.title,
      requirement: baseRequirement,
      deps,
      priority,
      acceptance: partial.acceptance,
      filesHint: hint,
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

  return truncateSubtasksIfNeeded(result, "bucket");
}

export const __internals = {
  classifyPath,
  normalisePrefix,
  stableId,
  uniq,
};
