import { accessSync, constants as fsConstants } from "node:fs";
import path from "node:path";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";
import {
  DEFAULT_ALLOW_PREFIXES,
  DirectoryAccessError,
  DirectoryHandle,
  openDirectorySecure,
  prepareCwdFromHandle,
} from "../../security/filesystem.js";
import { withPolicyApproval } from "./approval.js";

const OUTPUT_CAP_BYTES = 5 * 1024 * 1024; // 5 MiB
const DEFAULT_TIMEOUT_SEC = 15 * 60;
const MIN_TIMEOUT_SEC = 10;
const MAX_TIMEOUT_SEC = 2 * 60 * 60;

function assertAllowedDirectory(candidate: string) {
  let handle;
  try {
    handle = openDirectorySecure(candidate, {
      allowedPrefixes: DEFAULT_ALLOW_PREFIXES,
    });
    return handle.path;
  } catch (error) {
    if (
      error instanceof DirectoryAccessError &&
      error.code === "not_directory"
    ) {
      throw new Error("git_invalid_cwd_not_directory");
    }
    throw new Error("git_invalid_cwd");
  } finally {
    handle?.close();
  }
}

function acquireWorkingDirectoryHandle(candidate?: string): DirectoryHandle {
  try {
    return openDirectorySecure(candidate ?? process.cwd(), {
      allowedPrefixes: DEFAULT_ALLOW_PREFIXES,
    });
  } catch (error) {
    if (
      error instanceof DirectoryAccessError &&
      error.code === "not_directory"
    ) {
      throw new Error("git_invalid_cwd_not_directory");
    }
    throw new Error("git_invalid_cwd");
  }
}

function resolveExecutable(command: string) {
  if (path.isAbsolute(command)) {
    accessSync(command, fsConstants.X_OK);
    return command;
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, command);
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error("git_binary_not_found");
}

const gitInputSchema = z.object({
  action: z.enum([
    "branch.create",
    "branch.delete",
    "branch.update",
    "worktree.add",
    "worktree.remove",
    "commit",
    "push",
    "merge",
    "status",
    "diff",
    "fetch",
    "reset.hard",
  ]),
  cw: z.string().optional(),
  base: z.string().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
  message: z.string().optional(),
  remote: z.string().optional(),
  ref: z.string().optional(),
  noFF: z.boolean().optional(),
  authz: z.string().optional(),
  timeoutSec: z
    .number()
    .int()
    .min(MIN_TIMEOUT_SEC)
    .max(MAX_TIMEOUT_SEC)
    .optional(),
});

type GitInput = z.infer<typeof gitInputSchema>;

type ToolWriter =
  | { write: (chunk: unknown) => Promise<void> | void }
  | undefined;

const READ_ONLY_ACTIONS = new Set<GitInput["action"]>([
  "status",
  "diff",
  "fetch",
]);

async function enforcePolicy(input: GitInput, cwd: string) {
  const scopes = READ_ONLY_ACTIONS.has(input.action)
    ? ["repo.read"]
    : ["repo.write"];

  const { claims } = await requireToolScopesAndPolicy(input.authz, scopes, {
    action: `git.${input.action}`,
    resource: {
      kind: "repo",
      id: cwdHandle,
    },
  });

  if (
    (input.action === "push" || input.action === "merge") &&
    (!claims.elevated || claims.mfa !== "passkey")
  ) {
    throw new Error("biometric_required");
  }
}

async function runGit({
  cwdHandle,
  args,
  writer,
  timeoutSec,
}: {
  cwdHandle: DirectoryHandle;
  args: string[];
  writer: ToolWriter;
  timeoutSec: number;
}) {
  const command = resolveExecutable("git");
  const proc = Bun.spawn([command, ...args], {
    cwd: prepareCwdFromHandle(cwdHandle),
    env: {
      PATH: process.env.PATH ?? "",
    },
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const accumulator = {
    stdout: "",
    stderr: "",
    capturedBytes: 0,
    truncated: false,
  };

  const timer = setNodeTimeout(() => {
    try {
      proc.kill("SIGKILL");
    } catch {
      // noop
    }
    void Promise.resolve(
      writer?.write?.({ type: "notice", message: "git_timeout" })
    ).catch(() => {});
  }, timeoutSec * 1000);

  // Handle stdout stream
  if (proc.stdout && typeof proc.stdout !== "number") {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const text = decoder.decode(value);
          accumulator.capturedBytes += Buffer.byteLength(text);

          if (!accumulator.truncated) {
            if (accumulator.capturedBytes <= OUTPUT_CAP_BYTES) {
              accumulator.stdout += text;
            } else {
              accumulator.truncated = true;
            }
          }

          void Promise.resolve(writer?.write?.({ type: "stdout", text })).catch(
            () => {}
          );
        }
      } catch {
        // Ignore stream read errors
      }
    })();
  }

  // Handle stderr stream
  if (proc.stderr && typeof proc.stderr !== "number") {
    const reader = proc.stderr.getReader();
    const decoder = new TextDecoder();

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const text = decoder.decode(value);
          if (accumulator.stderr.length + text.length <= OUTPUT_CAP_BYTES) {
            accumulator.stderr += text;
          }
          void Promise.resolve(writer?.write?.({ type: "stderr", text })).catch(
            () => {}
          );
        }
      } catch {
        // Ignore stderr read errors
      }
    })();
  }

  let exitCode = 0;
  try {
    exitCode = await proc.exited;
  } catch (error) {
    clearNodeTimeout(timer);
    throw error;
  } finally {
    clearNodeTimeout(timer);
  }

  if (accumulator.truncated) {
    void Promise.resolve(
      writer?.write?.({ type: "notice", message: "git_output_truncated" })
    ).catch(() => {});
  }

  return {
    exitCode,
    stdout: accumulator.stdout.trim(),
    stderr: accumulator.stderr.trim(),
  };
}

function ensure(value: string | undefined, error: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(error);
  }
  return value;
}

export const toolGit = {
  name: "git",
  description:
    "Safe git operations (branch, worktree, commit, push, merge) under cwd sandbox.",
  inputSchema: gitInputSchema,
  outputSchema: z.object({
    ok: z.boolean(),
    details: z.unknown().optional(),
  }),
  execute: async ({
    input,
    writer,
  }: {
    input: GitInput;
    writer?: ToolWriter;
  }) => {
    const cwdHandle = acquireWorkingDirectoryHandle(input.cw);
    const cwdPath = cwdHandle.path;
    await enforcePolicy(input, cwdPath);
    const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;

    try {
      switch (input.action) {
      case "branch.create": {
        const name = ensure(input.name, "git_branch_name_required");
        const base = input.base ?? "HEAD";
        const { exitCode } = await runGit({
          cwdHandle,
          args: ["branch", name, base],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) {
          throw new Error("git_branch_create_failed");
        }
        return { ok: true };
      }

      case "branch.update": {
        const name = ensure(input.name, "git_branch_name_required");
        const base = ensure(input.base, "git_branch_base_required");
        const { exitCode } = await runGit({
          cwdHandle,
          args: ["branch", "-f", name, base],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) {
          throw new Error("git_branch_update_failed");
        }
        return { ok: true };
      }

      case "branch.delete": {
        const name = ensure(input.name, "git_branch_name_required");
        const { exitCode } = await runGit({
          cwdHandle,
          args: ["branch", "-D", name],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) {
          throw new Error("git_branch_delete_failed");
        }
        return { ok: true };
      }

      case "worktree.add": {
        const wtPath = ensure(input.path, "git_worktree_path_required");
        const ref = ensure(
          input.ref ?? input.name,
          "git_worktree_ref_required"
        );
        const args = ["worktree", "add", wtPath, ref];
        const { exitCode } = await runGit({ cwdHandle, args, writer, timeoutSec });
        if (exitCode !== 0) {
          throw new Error("git_worktree_add_failed");
        }
        return { ok: true, details: { path: wtPath, ref } };
      }

      case "worktree.remove": {
        const wtPath = ensure(input.path, "git_worktree_path_required");
        const { exitCode } = await runGit({
          cwdHandle,
          args: ["worktree", "remove", wtPath],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) {
          throw new Error("git_worktree_remove_failed");
        }
        return { ok: true };
      }

      case "commit": {
        const message = ensure(input.message, "git_commit_message_required");

        const status = await runGit({
          cwdHandle,
          args: ["status", "--porcelain"],
          writer,
          timeoutSec,
        });

        if (status.exitCode !== 0) {
          throw new Error("git_status_failed");
        }

        if (!status.stdout) {
          return { ok: true, details: { skipped: true, reason: "clean_tree" } };
        }

        const add = await runGit({
          cwdHandle,
          args: ["add", "-A"],
          writer,
          timeoutSec,
        });
        if (add.exitCode !== 0) {
          throw new Error("git_add_failed");
        }

        const commit = await runGit({
          cwdHandle,
          args: ["commit", "-m", message],
          writer,
          timeoutSec,
        });
        if (commit.exitCode !== 0) {
          throw new Error("git_commit_failed");
        }

        return { ok: true, details: { stdout: commit.stdout } };
      }

      case "push": {
        const remote = input.remote ?? "origin";
        const ref = ensure(input.ref ?? input.name, "git_push_ref_required");
        const { exitCode } = await runGit({
          cwdHandle,
          args: ["push", remote, ref],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) {
          throw new Error("git_push_failed");
        }
        return { ok: true };
      }

      case "merge": {
        const ref = ensure(input.ref ?? input.name, "git_merge_ref_required");
        const args = ["merge"];
        if (input.noFF !== false) {
          args.push("--no-ff");
        }
        args.push(ref);
        const { exitCode } = await runGit({ cwdHandle, args, writer, timeoutSec });
        if (exitCode !== 0) {
          throw new Error("git_merge_failed");
        }
        return { ok: true };
      }

      case "status": {
        const { exitCode, stdout } = await runGit({
          cwdHandle,
          args: ["status", "--porcelain=v2"],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) {
          throw new Error("git_status_failed");
        }
        return { ok: true, details: { status: stdout } };
      }

      case "diff": {
        const args = ["diff", "--name-only"];
        if (input.ref) {
          args.push(`${input.ref}..HEAD`);
        }
        const { exitCode, stdout } = await runGit({
          cwdHandle,
          args,
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) {
          throw new Error("git_diff_failed");
        }
        return {
          ok: true,
          details: { files: stdout.split(/\r?\n/).filter(Boolean) },
        };
      }

      case "fetch": {
        const remote =
          input.remote && input.remote.trim().length > 0
            ? input.remote
            : "origin";
        const { exitCode } = await runGit({
          cwdHandle,
          args: ["fetch", remote, "--prune", "--tags"],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) {
          throw new Error("git_fetch_failed");
        }
        return { ok: true };
      }

      case "reset.hard": {
        const ref = ensure(input.ref ?? input.base, "git_reset_ref_required");
        const { exitCode } = await runGit({
          cwdHandle,
          args: ["reset", "--hard", ref],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) {
          throw new Error("git_reset_failed");
        }
        return { ok: true };
      }

      default:
        throw new Error("git_action_not_supported");
    }
    } finally {
      cwdHandle.close();
    }
  },
};

const aiToolGitBase = {
  name: toolGit.name,
  description: toolGit.description,
  parameters: toolGit.inputSchema,
  inputSchema: toolGit.inputSchema,
  execute: async (input: GitInput) => toolGit.execute({ input }),
};

export const aiToolGit = withPolicyApproval(aiToolGitBase, (input) => {
  const scopes = READ_ONLY_ACTIONS.has(input.action)
    ? ["repo.read"]
    : ["repo.write"];
  return {
    action: `git.${input.action}`,
    resource: {
      kind: "repo",
      id: input.cw ? path.resolve(input.cw) : "cwd",
    },
    scopes,
    authz: input.authz,
  };
});

export type ToolGit = typeof toolGit;

export const __internals = {
  DEFAULT_ALLOW_PREFIXES,
  assertAllowedDirectory,
  resolveExecutable,
  runGit,
};
