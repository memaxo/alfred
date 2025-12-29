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
import { spawnWithSecureCwd } from "../../../security/secure-spawn.js";
import { CodexError } from "./error.js";
import { resolveExecutable } from "./policy.js";

type AllowedDirectoryHandle = {
  path: string;
  fd: number;
  close: () => void;
};

type SpawnInput = {
  containerId?: string;
  containerCw?: string;
  /** AgentFS database path for audit trail (optional) */
  agentfsDbPath?: string;
};

type SpawnResult = {
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill: (signal?: number | string) => void;
};

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
  containerId: string,
  containerCw?: string,
  agentfsDbPath?: string
): SpawnFn {
  return ({ cmd: _cmd, args, env: childEnv }) => {
    const containerWorkdir = containerCw?.trim();
    if (containerWorkdir && !containerWorkdir.startsWith("/workspace")) {
      throw new CodexError(
        "spawn",
        "codex_container_cwd_invalid",
        "containerCw must be under /workspace"
      );
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
      containerId,
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
  if (input.containerId) {
    const dockerBin = resolveExecutable("docker");
    return Promise.resolve(
      createDockerSpawn(
        cwdHandle,
        dockerBin,
        input.containerId,
        input.containerCw,
        input.agentfsDbPath
      )
    );
  }

  return Promise.resolve(createHostSpawn(cwdHandle, input.agentfsDbPath));
}
