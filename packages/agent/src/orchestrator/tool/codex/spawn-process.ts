/**
 * Codex process spawner
 *
 * Handles spawn function creation for different execution modes:
 * - Docker container execution (production)
 * - Direct host execution (development/testing)
 *
 * Note: Poof sandbox execution has been removed.
 * Use AgentFS for filesystem isolation with audit trails.
 */

import type { SpawnFn } from "@alfred/codex";

import path from "node:path";

import { spawnWithSecureCwd } from "../../../security/secure-spawn.js";
import { CodexError } from "./error.js";
import { resolveExecutable } from "./policy.js";

interface AllowedDirectoryHandle {
  path: string;
  fd: number;
  close: () => void;
}

interface SpawnInput {
  containerName?: string;
  containerCw?: string;
  /** AgentFS database path for audit trail (optional) */
  agentfsDbPath?: string;
}

interface SpawnResult {
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill: (signal?: number | string) => void;
}

function wrapProcess(proc: ReturnType<typeof spawnWithSecureCwd>): SpawnResult {
  return {
    stdout: typeof proc.stdout === "number" ? null : (proc.stdout ?? null),
    stderr: typeof proc.stderr === "number" ? null : (proc.stderr ?? null),
    exited: proc.exited,
    kill: (signal) => {
      if (typeof signal === "number") {
        proc.kill(signal);
        return;
      }
      if (typeof signal === "string") {
        proc.kill(signal as NodeJS.Signals);
        return;
      }
      proc.kill();
    },
  };
}

function createDockerSpawn(
  cwdHandle: AllowedDirectoryHandle,
  dockerBin: string,
  containerName: string,
  containerCw?: string,
  agentfsDbPath?: string
): SpawnFn {
  return ({ cmd: _cmd, args, env: childEnv }) => {
    const containerWorkdir = containerCw?.trim();
    if (containerWorkdir) {
      const normalized = path.posix.normalize(containerWorkdir);
      if (
        !normalized.startsWith("/workspace") ||
        (normalized !== "/workspace" && !normalized.startsWith("/workspace/"))
      ) {
        throw new CodexError(
          "spawn",
          "codex_container_cwd_invalid",
          "containerCw must be under /workspace"
        );
      }
    }
    const dockerWorkdir =
      containerWorkdir && containerWorkdir.length > 0
        ? containerWorkdir
        : "/workspace";

    // Include AgentFS db path in environment if provided
    const envWithAgentFS = agentfsDbPath
      ? { ...childEnv, AGENTFS_DB_PATH: agentfsDbPath }
      : childEnv;

    const envKeys = Object.keys(envWithAgentFS ?? {}).filter(
      (k) => k !== "PATH"
    );
    const dockerArgs = [
      "exec",
      "--workdir",
      dockerWorkdir,
      ...envKeys.flatMap((k) => ["-e", k]),
      containerName,
      "codex",
      ...args,
    ];

    const proc = spawnWithSecureCwd({
      cwdHandle,
      cmd: dockerBin,
      args: dockerArgs,
      env: envWithAgentFS,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    return wrapProcess(proc);
  };
}

function createHostSpawn(
  cwdHandle: AllowedDirectoryHandle,
  agentfsDbPath?: string
): SpawnFn {
  return ({ cmd, args, env: childEnv }) => {
    // Include AgentFS db path in environment if provided
    const envWithAgentFS = agentfsDbPath
      ? { ...childEnv, AGENTFS_DB_PATH: agentfsDbPath }
      : childEnv;

    const proc = spawnWithSecureCwd({
      cwdHandle,
      cmd,
      args,
      env: envWithAgentFS,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    return wrapProcess(proc);
  };
}

export function createCodexSpawn(
  input: SpawnInput,
  cwdHandle: AllowedDirectoryHandle
): Promise<SpawnFn> {
  if (input.containerName) {
    if (!input.containerName.startsWith("alfred-agentfs-")) {
      throw new CodexError(
        "spawn",
        "codex_container_name_invalid",
        "containerName must be an AgentFS workspace container"
      );
    }
    const dockerBin = resolveExecutable("docker");
    return Promise.resolve(
      createDockerSpawn(
        cwdHandle,
        dockerBin,
        input.containerName,
        input.containerCw,
        input.agentfsDbPath
      )
    );
  }

  return Promise.resolve(createHostSpawn(cwdHandle, input.agentfsDbPath));
}
