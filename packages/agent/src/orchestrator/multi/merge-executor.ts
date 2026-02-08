import type { DirectoryHandle } from "../../security/filesystem.js";
import type { GitInput } from "../tool/git";
import type { ToolWriter } from "../tool/shared/context.js";
import type { MergePlan } from "./merge";

import { openDirectorySecure } from "../../security/filesystem.js";
import { spawnWithSecureCwd } from "../../security/secure-spawn.js";
import { conflictArbiter } from "../conflict.js";
import { worktreeManager } from "../tool/worktree";

interface GitResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runGitCommand(
  cwdHandle: DirectoryHandle,
  args: string[]
): Promise<GitResult> {
  const proc = spawnWithSecureCwd({
    cwdHandle,
    cmd: "git",
    args,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout && typeof proc.stdout !== "number"
      ? new Response(proc.stdout).text()
      : Promise.resolve(""),
    proc.stderr && typeof proc.stderr !== "number"
      ? new Response(proc.stderr).text()
      : Promise.resolve(""),
    proc.exited,
  ]);

  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function detectCurrentBranch(cwdHandle: DirectoryHandle) {
  const res = await runGitCommand(cwdHandle, [
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]);
  if (res.exitCode === 0 && res.stdout) {
    return res.stdout === "HEAD" ? "dev" : res.stdout;
  }
  return "dev";
}

async function ensureBranchCheckedOut(
  cwdHandle: DirectoryHandle,
  branch: string
) {
  const res = await runGitCommand(cwdHandle, [
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]);
  if (res.exitCode === 0 && res.stdout === branch) {
    return;
  }
  const checkout = await runGitCommand(cwdHandle, ["checkout", branch]);
  if (checkout.exitCode !== 0) {
    throw new Error(
      `Unable to checkout ${branch}: ${checkout.stderr || checkout.stdout}`
    );
  }
}

export interface MergeResult {
  status: "completed" | "conflict" | "failed";
  mergedBranches: string[];
  targetBranch: string;
  conflictBranch?: string;
  conflictFiles?: string[];
  error?: string;
}

export interface GitTool {
  execute(args: {
    input: GitInput;
    writer?: ToolWriter;
  }): Promise<{ ok: boolean; details?: unknown }>;
}

export interface ConflictArbiterLike {
  resolve: typeof conflictArbiter.resolve;
}

export async function executeMergePlan(
  plan: MergePlan,
  workspace: string,
  git: GitTool,
  writer: ToolWriter | undefined,
  options: {
    authz?: string;
    runId?: string;
    userId?: string;
    auto?: "read" | "low" | "medium" | "high";
    containerName: string;
    containerCw: string;
    arbiter?: ConflictArbiterLike;
  }
): Promise<MergeResult> {
  const cwdHandle = openDirectorySecure(workspace, {
    allowedPrefixes: [workspace],
  });
  const resolvedCw = cwdHandle.path;
  try {
    if (!plan.branches || plan.branches.length === 0) {
      return {
        status: "completed",
        mergedBranches: [],
        targetBranch:
          plan.targetBranch ?? (await detectCurrentBranch(cwdHandle)),
      };
    }

    const targetBranch =
      plan.targetBranch ?? (await detectCurrentBranch(cwdHandle));
    await ensureBranchCheckedOut(cwdHandle, targetBranch);

    const merged: string[] = [];

    for (const branch of plan.branches) {
      try {
        const preview = await worktreeManager.safeMerge(
          resolvedCw,
          targetBranch,
          branch,
          { runId: options.runId }
        );
        if (!preview.success) {
          const { runId } = options;
          const shouldArbitrate =
            (options.auto === "medium" || options.auto === "high") &&
            typeof runId === "string" &&
            runId.length > 0;

          if (!shouldArbitrate) {
            return {
              status: "conflict",
              mergedBranches: merged,
              targetBranch,
              conflictBranch: branch,
              conflictFiles: preview.conflictFiles,
            };
          }

          const arbiter = options.arbiter ?? conflictArbiter;
          const resolution = await arbiter.resolve(
            resolvedCw,
            runId,
            targetBranch,
            branch,
            options.containerName,
            options.containerCw,
            options.authz,
            options.userId,
            options.auto === "high" ? "high" : "medium"
          );

          if (resolution.status !== "resolved") {
            return {
              status: "conflict",
              mergedBranches: merged,
              targetBranch,
              conflictBranch: branch,
              conflictFiles: preview.conflictFiles,
              error: `arbiter_failed:${resolution.reason}`,
            };
          }

          const mergeResult = await git.execute({
            input: {
              action: "merge",
              ref: resolution.resolvedBranch,
              cw: resolvedCw,
              authz: options.authz,
              // Allow fast-forward to the arbiter's merge commit.
              noFF: false,
            },
            writer,
          });

          if (!mergeResult.ok) {
            return {
              status: "failed",
              mergedBranches: merged,
              targetBranch,
              conflictBranch: branch,
              error: "arbiter_merge_failed",
            };
          }

          merged.push(branch);
          continue;
        }

        await git.execute({
          input: {
            action: "merge",
            ref: branch,
            cw: resolvedCw,
            authz: options.authz,
          },
          writer,
        });
        merged.push(branch);
      } catch (error: unknown) {
        return {
          status: "failed",
          mergedBranches: merged,
          targetBranch,
          conflictBranch: branch,
          error:
            error instanceof Error
              ? error.message
              : (typeof error === "string"
                ? error
                : String(error)),
        };
      }
    }

    return { status: "completed", mergedBranches: merged, targetBranch };
  } finally {
    cwdHandle.close();
  }
}
