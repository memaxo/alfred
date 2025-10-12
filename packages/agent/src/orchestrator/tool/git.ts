import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { spawn } from "node:child_process";
import { accessSync, realpathSync, statSync } from "node:fs";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { clearTimeout as clearNodeTimeout, setTimeout as setNodeTimeout } from "node:timers";
import { z } from "zod";

const OUTPUT_CAP_BYTES = 5 * 1024 * 1024; // 5 MiB
const DEFAULT_TIMEOUT_SEC = 15 * 60;
const MIN_TIMEOUT_SEC = 10;
const MAX_TIMEOUT_SEC = 2 * 60 * 60;

const DEFAULT_ALLOW_PREFIXES = (() => {
  const base = realpathSync(process.cwd());
  const raw = process.env.ORCH_ALLOW_CWD_PREFIXES;
  const extras =
    raw && raw.trim().length > 0
      ? raw
          .split(path.delimiter)
          .map(entry => entry.trim())
          .filter(Boolean)
      : [];

  const prefixes = new Set<string>([base]);

  for (const entry of extras) {
    try {
      const absolute = path.isAbsolute(entry) ? entry : path.resolve(base, entry);
      prefixes.add(realpathSync(absolute));
    } catch {
      // Ignore invalid entries so that a bad env var does not break execution.
    }
  }

  return Array.from(prefixes);
})();

function safeRealpath(p: string) {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

function isWithinBase(base: string, target: string) {
  const baseReal = safeRealpath(base);
  const targetReal = safeRealpath(target);
  if (!baseReal || !targetReal) return false;
  const relative = path.relative(baseReal, targetReal);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertAllowedDirectory(candidate: string) {
  const real = safeRealpath(candidate);
  if (!real) {
    throw new Error("git_invalid_cwd");
  }
  for (const prefix of DEFAULT_ALLOW_PREFIXES) {
    if (isWithinBase(prefix, real)) {
      const stats = statSync(real);
      if (!stats.isDirectory()) {
        throw new Error("git_invalid_cwd_not_directory");
      }
      return real;
    }
  }
  throw new Error("git_invalid_cwd");
}

function resolveExecutable(command: string) {
  if (path.isAbsolute(command)) {
    accessSync(command, fsConstants.X_OK);
    return command;
  }

  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
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
    "worktree.add",
    "worktree.remove",
    "commit",
    "push",
    "merge",
    "status",
    "diff",
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
  timeoutSec: z.number().int().min(MIN_TIMEOUT_SEC).max(MAX_TIMEOUT_SEC).optional(),
});

type GitInput = z.infer<typeof gitInputSchema>;

type ToolWriter = { write: (chunk: unknown) => Promise<void> | void } | undefined;

const READ_ONLY_ACTIONS = new Set<GitInput["action"]>(["status", "diff"]);

async function enforcePolicy(input: GitInput, cwd: string) {
  const scopes = READ_ONLY_ACTIONS.has(input.action) ? ["repo.read"] : ["repo.write"];

  const { claims } = await requireToolScopesAndPolicy(input.authz, scopes, {
    action: `git.${input.action}`,
    resource: {
      kind: "repo",
      id: cwd,
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
  cwd,
  args,
  writer,
  timeoutSec,
}: {
  cwd: string;
  args: string[];
  writer: ToolWriter;
  timeoutSec: number;
}) {
  const command = resolveExecutable("git");
  const child = spawn(command, args, {
    cwd,
    env: {
      PATH: process.env.PATH ?? "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const accumulator = {
    stdout: "",
    stderr: "",
    capturedBytes: 0,
    truncated: false,
  };

  const timer = setNodeTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // noop
    }
    void Promise.resolve(writer?.write?.({ type: "notice", message: "git_timeout" })).catch(() => {});
  }, timeoutSec * 1000);

  child.stdout?.on("data", chunk => {
    const text = chunk.toString();
    accumulator.capturedBytes += Buffer.byteLength(text);

    if (!accumulator.truncated) {
      if (accumulator.capturedBytes <= OUTPUT_CAP_BYTES) {
        accumulator.stdout += text;
      } else {
        accumulator.truncated = true;
      }
    }

    void Promise.resolve(writer?.write?.({ type: "stdout", text })).catch(() => {});
  });

  child.stderr?.on("data", chunk => {
    const text = chunk.toString();
    if (accumulator.stderr.length + text.length <= OUTPUT_CAP_BYTES) {
      accumulator.stderr += text;
    }
    void Promise.resolve(writer?.write?.({ type: "stderr", text })).catch(() => {});
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", err => {
      clearNodeTimeout(timer);
      reject(err);
    });
    child.on("close", code => resolve(code ?? 0));
  }).finally(() => {
    clearNodeTimeout(timer);
  });

  if (accumulator.truncated) {
    void Promise.resolve(writer?.write?.({ type: "notice", message: "git_output_truncated" })).catch(
      () => {},
    );
  }

  return { exitCode, stdout: accumulator.stdout.trim(), stderr: accumulator.stderr.trim() };
}

function ensure(value: string | undefined, error: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(error);
  }
  return value;
}

export const toolGit = {
  name: "git",
  description: "Safe git operations (branch, worktree, commit, push, merge) under cwd sandbox.",
  inputSchema: gitInputSchema,
  outputSchema: z.object({
    ok: z.boolean(),
    details: z.unknown().optional(),
  }),
  execute: async ({ input, writer }: { input: GitInput; writer?: ToolWriter }) => {
    const cwd = input.cw ? assertAllowedDirectory(input.cw) : process.cwd();
    await enforcePolicy(input, cwd);
    const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;

    switch (input.action) {
      case "branch.create": {
        const name = ensure(input.name, "git_branch_name_required");
        const base = input.base ?? "HEAD";
        const { exitCode } = await runGit({
          cwd,
          args: ["branch", name, base],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) throw new Error("git_branch_create_failed");
        return { ok: true };
      }

      case "branch.delete": {
        const name = ensure(input.name, "git_branch_name_required");
        const { exitCode } = await runGit({
          cwd,
          args: ["branch", "-D", name],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) throw new Error("git_branch_delete_failed");
        return { ok: true };
      }

      case "worktree.add": {
        const wtPath = ensure(input.path, "git_worktree_path_required");
        const ref = ensure(input.ref ?? input.name, "git_worktree_ref_required");
        const args = ["worktree", "add", wtPath, ref];
        const { exitCode } = await runGit({ cwd, args, writer, timeoutSec });
        if (exitCode !== 0) throw new Error("git_worktree_add_failed");
        return { ok: true, details: { path: wtPath, ref } };
      }

      case "worktree.remove": {
        const wtPath = ensure(input.path, "git_worktree_path_required");
        const { exitCode } = await runGit({
          cwd,
          args: ["worktree", "remove", wtPath],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) throw new Error("git_worktree_remove_failed");
        return { ok: true };
      }

      case "commit": {
        const message = ensure(input.message, "git_commit_message_required");

        const status = await runGit({
          cwd,
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
          cwd,
          args: ["add", "-A"],
          writer,
          timeoutSec,
        });
        if (add.exitCode !== 0) {
          throw new Error("git_add_failed");
        }

        const commit = await runGit({
          cwd,
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
          cwd,
          args: ["push", remote, ref],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) throw new Error("git_push_failed");
        return { ok: true };
      }

      case "merge": {
        const ref = ensure(input.ref ?? input.name, "git_merge_ref_required");
        const args = ["merge"];
        if (input.noFF !== false) {
          args.push("--no-ff");
        }
        args.push(ref);
        const { exitCode } = await runGit({ cwd, args, writer, timeoutSec });
        if (exitCode !== 0) throw new Error("git_merge_failed");
        return { ok: true };
      }

      case "status": {
        const { exitCode, stdout } = await runGit({
          cwd,
          args: ["status", "--porcelain=v2"],
          writer,
          timeoutSec,
        });
        if (exitCode !== 0) throw new Error("git_status_failed");
        return { ok: true, details: { status: stdout } };
      }

      case "diff": {
        const args = ["diff", "--name-only"];
        if (input.ref) {
          args.push(`${input.ref}..HEAD`);
        }
        const { exitCode, stdout } = await runGit({ cwd, args, writer, timeoutSec });
        if (exitCode !== 0) throw new Error("git_diff_failed");
        return { ok: true, details: { files: stdout.split(/\r?\n/).filter(Boolean) } };
      }

      default:
        throw new Error("git_action_not_supported");
    }
  },
};

export type ToolGit = typeof toolGit;

export const __internals = {
  DEFAULT_ALLOW_PREFIXES,
  assertAllowedDirectory,
  resolveExecutable,
  runGit,
};

