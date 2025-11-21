import type { MergePlan } from "./merge";

export type MergeResult = {
  status: "completed" | "conflict" | "failed";
  mergedBranches: string[];
  conflictBranch?: string;
  error?: string;
};

export type GitTool = {
  execute(args: { input: any; writer?: any }): Promise<any>;
};

export async function executeMergePlan(
  plan: MergePlan,
  workspace: string,
  git: GitTool,
  writer?: any,
  authz?: string
): Promise<MergeResult> {
  if (!plan.branches || plan.branches.length === 0) {
    return { status: "completed", mergedBranches: [] };
  }

  const merged: string[] = [];

  // Assume workspace is already on the target base branch (e.g. main)
  // or we might need to ensure it?
  // For now, we assume the orchestrator sets up the workspace state or we just merge into current HEAD.

  for (const branch of plan.branches) {
    try {
      await git.execute({
        input: {
          action: "merge",
          ref: branch,
          cw: workspace,
          authz,
        },
        writer,
      });
      merged.push(branch);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      if (msg.includes("git_merge_failed")) {
        // Conflict detected
        return {
          status: "conflict",
          mergedBranches: merged,
          conflictBranch: branch,
          error: msg,
        };
      }
      return {
        status: "failed",
        mergedBranches: merged,
        conflictBranch: branch,
        error: msg,
      };
    }
  }

  return { status: "completed", mergedBranches: merged };
}
