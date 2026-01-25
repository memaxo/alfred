import { logger } from "@alfred/logger";

import type { SubTask, SubTaskId } from "./decompose";

import { createLinearBlockingRelation } from "../linear";

export interface LinearSyncConfig {
  space: string;
  authz: string;
}

export interface LinearSyncResult {
  synced: number;
  failed: number;
  errors: { from: SubTaskId; to: SubTaskId; error: string }[];
}

/**
 * Sync SubTask dependencies to Linear as blocking relations.
 * Creates "blocks" relations for each dependency edge in the task graph.
 *
 * @param tasks - Array of decomposed subtasks with dependencies
 * @param taskToIssueId - Map from SubTaskId to Linear issue ID
 * @param config - Linear workspace and auth configuration
 */
export async function syncDepsToLinear(
  tasks: SubTask[],
  taskToIssueId: Map<SubTaskId, string>,
  config: LinearSyncConfig
): Promise<LinearSyncResult> {
  const result: LinearSyncResult = {
    synced: 0,
    failed: 0,
    errors: [],
  };

  for (const task of tasks) {
    const taskIssueId = taskToIssueId.get(task.id);
    if (!taskIssueId) {
      continue;
    }

    for (const depId of task.deps) {
      const depIssueId = taskToIssueId.get(depId);
      if (!depIssueId) {
        continue;
      }

      try {
        // SubTask deps are prerequisites. That means the dependency must be done
        // before the task can proceed.
        // In Linear terms: depIssue blocks taskIssue.
        const response = await createLinearBlockingRelation({
          space: config.space,
          blockingIssueId: depIssueId,
          blockedIssueId: taskIssueId,
          authz: config.authz,
        });

        if (response.ok) {
          result.synced++;
        } else {
          result.failed++;
          result.errors.push({
            from: depId,
            to: task.id,
            error: "linear_relation_failed",
          });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          from: depId,
          to: task.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (result.failed > 0) {
    logger.warn("linear_sync_deps_partial_failure", {
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.slice(0, 10),
    });
  } else if (result.synced > 0) {
    logger.info("linear_sync_deps_complete", {
      synced: result.synced,
    });
  }

  return result;
}

/**
 * Build a task-to-issue mapping from Linear issue creation results.
 */
export function buildTaskIssueMap(
  tasks: SubTask[],
  issueIds: string[]
): Map<SubTaskId, string> {
  const map = new Map<SubTaskId, string>();

  for (let i = 0; i < tasks.length && i < issueIds.length; i++) {
    const task = tasks[i];
    const issueId = issueIds[i];
    if (task && issueId) {
      map.set(task.id, issueId);
    }
  }

  return map;
}
