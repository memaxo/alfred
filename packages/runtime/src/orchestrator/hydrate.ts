import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import type { WorkflowEvent } from "@alfred/type/plan";

import {
  createTrackerContext,
  type TrackerContext,
} from "@alfred/agent/orchestrator/multi/tracker";
import { openDirectorySecure } from "@alfred/agent/security/filesystem";

/**
 * Hydrate tracker context from workflow history.
 * Creates a TrackerContext with dependencies initialized from subtasks.
 */
export function hydrateTrackerContext(
  history: WorkflowEvent[] | undefined,
  subTasks: SubTask[]
): TrackerContext {
  const ctx = createTrackerContext(subTasks);

  if (!history || history.length === 0) {
    return ctx;
  }

  const waveResults = history.filter((e) => (e as any).kind === "wave-result");
  for (const res of waveResults) {
    const data = (res as any).data;
    if (data?.waveId) {
      ctx.state.waves[data.waveId] = {
        status: data.status === "partial" ? "failed" : "completed",
      } as any;
    }
  }

  return ctx;
}

/**
 * Normalize a working directory path, ensuring it's within the allowed workspace root.
 * Uses secure directory handle to prevent TOCTOU attacks.
 */
export function normalizeWorkingDirectory(
  candidate: string,
  workspaceRoot: string
): string {
  const target = candidate?.trim() ? candidate : workspaceRoot;
  const handle = openDirectorySecure(target, {
    allowedPrefixes: [workspaceRoot],
  });
  const normalized = handle.path;
  handle.close();
  return normalized;
}
