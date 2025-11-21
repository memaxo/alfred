import type { SubTaskId } from "./decompose";
import type { AgentId } from "./spawn";

export type AgentStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "stuck"
  | "paused";

export type AgentOutcome = {
  agentId: AgentId;
  subTaskId: SubTaskId;
  status: AgentStatus;
  result?: {
    summary: string;
    artifacts: Array<{ path: string; kind: string }>;
    changes?: string[];
    notes?: string[];
  };
  error?: { code: string; message: string };
  metrics?: {
    durationMs: number;
    commandsRun?: number;
    filesChanged?: number;
  };
};

export type MergePlan = {
  summary: string;
  branches?: string[];
  expectedFiles?: string[];
  strategy?: "worktree" | "branch" | "direct";
};

function collectFiles(outcomes: AgentOutcome[]): string[] {
  const files = new Set<string>();

  for (const outcome of outcomes) {
    const result = outcome.result;
    if (!result) continue;

    for (const change of result.changes ?? []) {
      const path = String(change).trim();
      if (path) {
        files.add(path);
      }
    }

    for (const artifact of result.artifacts ?? []) {
      const path = artifact.path?.trim();
      if (path) {
        files.add(path);
      }
    }
  }

  return Array.from(files).sort();
}

export function buildMergePlan(subOutcomes: AgentOutcome[]): MergePlan {
  if (subOutcomes.length === 0) {
    return {
      summary: "No agent outcomes to merge.",
      strategy: "direct",
      expectedFiles: [],
      branches: [],
    };
  }

  const expectedFiles = collectFiles(subOutcomes);

  const completed = subOutcomes.filter((o) => o.status === "completed");
  const failed = subOutcomes.filter((o) => o.status === "failed");
  const stuck = subOutcomes.filter((o) => o.status === "stuck");

  const parts: string[] = [];
  parts.push(
    `Merge results from ${subOutcomes.length} agents (${completed.length} completed, ${failed.length} failed, ${stuck.length} stuck).`,
  );

  if (expectedFiles.length > 0) {
    parts.push(`Verify merged content for ${expectedFiles.length} files.`);
  } else {
    parts.push("No explicit file changes reported; verify working tree state.");
  }

  const summary = parts.join(" ");

  // MVP: choose direct strategy. More advanced strategies (worktrees/branches)
  // can be introduced later when agents operate on separate branches.
  const plan: MergePlan = {
    summary,
    strategy: "direct",
    expectedFiles,
    branches: [],
  };

  return plan;
}
