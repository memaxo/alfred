/**
 * Upstream Failure Propagation
 *
 * Propagates failure context from failed tasks to their dependents,
 * enabling downstream tasks to avoid known failure patterns.
 */

import { type FailureContext, type UpstreamFailure } from "@alfred/type";
import { type SubTask, type SubTaskId } from "@alfred/type/plan";

/**
 * Build a dependency graph from tasks.
 */
function buildDependencyGraph(
  tasks: SubTask[]
): Map<SubTaskId, Set<SubTaskId>> {
  const graph = new Map<SubTaskId, Set<SubTaskId>>();

  for (const task of tasks) {
    graph.set(task.id as SubTaskId, new Set(task.deps as SubTaskId[]));
  }

  return graph;
}

/**
 * Find all transitive dependencies of a task.
 */
function findTransitiveDeps(
  taskId: SubTaskId,
  graph: Map<SubTaskId, Set<SubTaskId>>,
  visited = new Set<SubTaskId>()
): Set<SubTaskId> {
  if (visited.has(taskId)) {
    return visited;
  }

  const directDeps = graph.get(taskId);
  if (!directDeps) {
    return visited;
  }

  for (const dep of directDeps) {
    visited.add(dep);
    findTransitiveDeps(dep, graph, visited);
  }

  return visited;
}

/**
 * Build upstream failure summary for a task.
 */
function buildUpstreamFailure(failure: FailureContext): UpstreamFailure {
  const summaryParts: string[] = [`Failed with status: ${failure.status}`];

  if (failure.stuckReason) {
    summaryParts.push(failure.stuckReason);
  } else if (failure.escalations.length > 0 && failure.escalations[0]) {
    summaryParts.push(failure.escalations[0].details);
  } else if (failure.loopDetections.length > 0 && failure.loopDetections[0]) {
    summaryParts.push(`Loop detected: ${failure.loopDetections[0].reason}`);
  } else if (failure.reviewFailures.length > 0 && failure.reviewFailures[0]) {
    summaryParts.push(`Review failed: ${failure.reviewFailures[0].check}`);
  }

  return {
    summary: summaryParts.join(". "),
    taskId: failure.taskId,
    toolsToAvoid: failure.toolErrors
      .filter((e) => e.count >= 2)
      .map((e) => e.tool),
  };
}

/**
 * Propagate failure context from failed tasks to their dependents.
 *
 * This enables downstream tasks to:
 * 1. Know which upstream tasks failed and why
 * 2. Avoid tools that repeatedly failed
 * 3. Adjust their approach based on upstream failures
 */
export function propagateUpstreamFailures(
  tasks: SubTask[],
  failures: Map<string, FailureContext>,
  options?: {
    includeTransitive?: boolean;
    maxUpstreamFailures?: number;
  }
): SubTask[] {
  if (failures.size === 0) {
    return tasks;
  }

  const includeTransitive = options?.includeTransitive ?? false;
  const maxUpstreamFailures = options?.maxUpstreamFailures ?? 5;
  const graph = buildDependencyGraph(tasks);

  return tasks.map((task) => {
    const depsToCheck = includeTransitive
      ? findTransitiveDeps(task.id as SubTaskId, graph)
      : new Set(task.deps as SubTaskId[]);

    const upstreamFailures: UpstreamFailure[] = [];

    for (const depId of depsToCheck) {
      const failure = failures.get(depId);
      if (failure) {
        upstreamFailures.push(buildUpstreamFailure(failure));
      }

      if (upstreamFailures.length >= maxUpstreamFailures) {
        break;
      }
    }

    if (upstreamFailures.length === 0) {
      return task;
    }

    return {
      ...task,
      metadata: {
        ...task.metadata,
        upstreamFailures,
      },
    };
  });
}

/**
 * Collect all tools that should be avoided based on failures.
 */
export function collectToolsToAvoid(
  failures: Map<string, FailureContext>,
  minFailureCount = 2
): Map<string, string> {
  const toolsToAvoid = new Map<string, string>();

  for (const failure of failures.values()) {
    for (const err of failure.toolErrors) {
      if (err.count >= minFailureCount && !toolsToAvoid.has(err.tool)) {
        toolsToAvoid.set(err.tool, err.error);
      }
    }
  }

  return toolsToAvoid;
}

/**
 * Get a summary of all upstream failures for a task.
 */
export function getUpstreamFailureSummary(
  taskId: string,
  tasks: SubTask[],
  failures: Map<string, FailureContext>
): string {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return "";
  }

  const failedDeps = task.deps.filter((d) => failures.has(d));
  if (failedDeps.length === 0) {
    return "";
  }

  const summaries = failedDeps.map((depId) => {
    const failure = failures.get(depId)!;
    return `- ${depId}: ${failure.status}${failure.stuckReason ? ` (${failure.stuckReason})` : ""}`;
  });

  return `Upstream failures:\n${summaries.join("\n")}`;
}
