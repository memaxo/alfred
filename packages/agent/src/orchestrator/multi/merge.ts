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
    branch?: string; // Added: track the branch if worktree was used
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
  branches: string[];
  expectedFiles: string[];
  strategy: "worktree" | "branch" | "direct";
  targetBranch: string;
  changedPackages: string[];
};

function collectFiles(outcomes: AgentOutcome[]): string[] {
  const files = new Set<string>();

  for (const outcome of outcomes) {
    const result = outcome.result;
    if (!result) {
      continue;
    }

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

function collectBranches(outcomes: AgentOutcome[]): string[] {
  const branches = new Set<string>();
  for (const outcome of outcomes) {
    const branch = outcome.result?.branch;
    if (branch && typeof branch === "string") {
      branches.add(branch);
    }
  }
  return Array.from(branches).sort();
}

function inferPackages(files: string[]): string[] {
  const packages = new Set<string>();
  for (const file of files) {
    if (file.startsWith("packages/")) {
      const [scope, name] = file.split("/");
      if (scope && name) {
        packages.add(`${scope}/${name}`);
      }
    } else if (file.startsWith("apps/")) {
      const [scope, name] = file.split("/");
      if (scope && name) {
        packages.add(`${scope}/${name}`);
      }
    }
  }
  return Array.from(packages).sort();
}

export function buildMergePlan(
  subOutcomes: AgentOutcome[],
  options?: { targetBranch?: string }
): MergePlan {
  if (subOutcomes.length === 0) {
    return {
      summary: "No agent outcomes to merge.",
      strategy: "direct",
      expectedFiles: [],
      branches: [],
      targetBranch: options?.targetBranch ?? "dev",
      changedPackages: [],
    };
  }

  const expectedFiles = collectFiles(subOutcomes);
  const branches = collectBranches(subOutcomes);
  const changedPackages = inferPackages(expectedFiles);

  const targetBranch = options?.targetBranch ?? "dev";

  const completed = subOutcomes.filter((o) => o.status === "completed");
  const failed = subOutcomes.filter((o) => o.status === "failed");
  const stuck = subOutcomes.filter((o) => o.status === "stuck");

  const parts: string[] = [];
  parts.push(
    `Merge results from ${subOutcomes.length} agents (${completed.length} completed, ${failed.length} failed, ${stuck.length} stuck) targeting '${targetBranch}'.`
  );

  let strategy: "worktree" | "branch" | "direct" = "direct";

  if (branches.length > 0) {
    parts.push(`Merging ${branches.length} feature branches.`);
    strategy = "branch"; // Or "worktree", semantics similar for the agent
  } else if (expectedFiles.length > 0) {
    parts.push(`Verify merged content for ${expectedFiles.length} files.`);
  } else {
    parts.push("No explicit file changes reported; verify working tree state.");
  }

  const summary = parts.join(" ");

  return {
    summary,
    strategy,
    expectedFiles,
    branches,
    targetBranch,
    changedPackages,
  };
}

export function generateMergeExecPlanSkeleton(
  runId: string,
  mergePlan: MergePlan
): string {
  const lines: string[] = [];
  lines.push(`# Merge ExecPlan for run ${runId}`);
  lines.push("");
  lines.push(
    "This ExecPlan guides a merge analysis for the multi-agent workflow."
  );
  lines.push("");
  lines.push("## Purpose");
  lines.push("");
  lines.push(
    "Understand and validate the combined changes from all subtasks before any merge is applied."
  );
  lines.push("");
  lines.push("## Context");
  lines.push("");
  lines.push(mergePlan.summary);
  lines.push("");
  lines.push(`Target branch: ${mergePlan.targetBranch}`);
  lines.push("");

  if (mergePlan.branches.length > 0) {
    lines.push("Branches to merge:");
    for (const branch of mergePlan.branches) {
      lines.push(`- ${branch}`);
    }
    lines.push("");
  }

  if (mergePlan.expectedFiles.length > 0) {
    lines.push("Expected files to inspect (from file events):");
    for (const file of mergePlan.expectedFiles) {
      lines.push(`- ${file}`);
    }
    lines.push("");
  }

  if (mergePlan.changedPackages.length > 0) {
    lines.push("Packages/apps touched:");
    for (const pkg of mergePlan.changedPackages) {
      lines.push(`- ${pkg}`);
    }
    lines.push("");
  }
  lines.push("## Plan");
  lines.push("");
  if (mergePlan.strategy === "branch") {
    lines.push("- Checkout main branch.");
    lines.push("- For each feature branch, attempt merge.");
    lines.push("- Resolve conflicts if any.");
  } else {
    lines.push("- Identify overlapping or conflicting edits between agents.");
  }
  lines.push(
    "- Verify that each changed file still compiles and satisfies its contracts."
  );
  lines.push(
    "- Note any risky areas that require focused tests or manual review."
  );
  lines.push("");
  lines.push("## Progress");
  lines.push("");
  lines.push("- [ ] (pending) Merge analysis started.");
  lines.push("");
  lines.push("## Surprises & Discoveries");
  lines.push("");
  lines.push("- Pending.");
  lines.push("");
  lines.push("## Decision Log");
  lines.push("");
  lines.push("- Pending.");
  lines.push("");
  lines.push("## Outcomes & Retrospective");
  lines.push("");
  lines.push("- Pending.");
  lines.push("");
  return lines.join("\n");
}
