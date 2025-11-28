import { sys } from "../../utils/process";
import { worktreeManager } from "../tool/worktree";
import type { MergePlan } from "./merge";

type GitResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function runGitCommand(cwd: string, args: string[]): Promise<GitResult> {
  const proc = sys.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(""),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(""),
    proc.exited,
  ]);

  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function detectCurrentBranch(cwd: string) {
  const res = await runGitCommand(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (res.exitCode === 0 && res.stdout) {
    return res.stdout === "HEAD" ? "dev" : res.stdout;
  }
  return "dev";
}

async function ensureBranchCheckedOut(cwd: string, branch: string) {
  const res = await runGitCommand(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (res.exitCode === 0 && res.stdout === branch) {
    return;
  }
  const checkout = await runGitCommand(cwd, ["checkout", branch]);
  if (checkout.exitCode !== 0) {
    throw new Error(
      `Unable to checkout ${branch}: ${checkout.stderr || checkout.stdout}`
    );
  }
}

export type MergeResult = {
  status: "completed" | "conflict" | "failed";
  mergedBranches: string[];
  targetBranch: string;
  conflictBranch?: string;
  conflictFiles?: string[];
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
  options?: { authz?: string; runId?: string }
): Promise<MergeResult> {
  if (!plan.branches || plan.branches.length === 0) {
    return {
      status: "completed",
      mergedBranches: [],
      targetBranch: plan.targetBranch ?? (await detectCurrentBranch(workspace)),
    };
  }

  const targetBranch =
    plan.targetBranch ?? (await detectCurrentBranch(workspace));
  await ensureBranchCheckedOut(workspace, targetBranch);

  const merged: string[] = [];

  for (const branch of plan.branches) {
    try {
      const preview = await worktreeManager.safeMerge(
        workspace,
        targetBranch,
        branch,
        { runId: options?.runId }
      );
      if (!preview.success) {
        return {
          status: "conflict",
          mergedBranches: merged,
          targetBranch,
          conflictBranch: branch,
          conflictFiles: preview.conflictFiles,
        };
      }

      await git.execute({
        input: {
          action: "merge",
          ref: branch,
          cw: workspace,
          authz: options?.authz,
        },
        writer,
      });
      merged.push(branch);
    } catch (error: any) {
      return {
        status: "failed",
        mergedBranches: merged,
        targetBranch,
        conflictBranch: branch,
        error: error?.message ?? String(error),
      };
    }
  }

  return { status: "completed", mergedBranches: merged, targetBranch };
}
